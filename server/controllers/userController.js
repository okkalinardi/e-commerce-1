const { User, Income, Purchase, Product } = require('../models')
const jwt = require('jsonwebtoken')
const { comparePass } = require('../helpers/bcrypt')

class UserController {
    static register(req, res, next) {
        let { name, email, address, password, phone, shopName } = req.body
        User.create({
            name,
            email,
            address,
            phone,
            password,
            shopName,
            role: req.body.role || 'user'
        })
            .then(userData => {
                let userInfo = {
                    id: userData.id,
                    name: userData.name,
                    email: userData.email,
                    address: userData.address,
                    phone: userData.phone,
                    role: userData.role,
                    shopName: userData.shopName
                }
                let payload = {
                    id: userData.id,
                    role: userData.role
                }
                let token = jwt.sign(payload, process.env.JWT_SECRET)
                res.status(201).json({ token, userInfo })
            })
            .catch(err => {
                next(err);
            })
    }

    static login(req, res, next) {
        let userInfo
        User.findOne({
            where: {
                email: req.body.email
            }
        })
            .then(userData => {
                if (!userData) {
                    throw ({
                        statusCode: 400,
                        message: 'Invalid email / password'
                    })
                } else {
                    userInfo = {
                        id: userData.id,
                        name: userData.name,
                        email: userData.email,
                        address: userData.address,
                        phone: userData.phone,
                        role: userData.role,
                        shopName: userData.shopName
                    }
                    return comparePass(req.body.password, userData.password)
                }
            })
            .then(compareResult => {
                if (!compareResult) {
                    throw ({
                        statusCode: 400,
                        message: 'Invalid email / password'
                    })
                } else {
                    let payload = {
                        id: userInfo.id,
                        role: userInfo.role
                    }
                    let token = jwt.sign(payload, process.env.JWT_SECRET)
                    res.status(200).json({
                        token,
                        userInfo
                    })
                }
            })
            .catch(err => {
                next(err)
            })
    }

    static registerShop(req, res, next) {
        if (!req.body.shopName) {
            throw ({
                statusCode: 400,
                message: 'Please enter shop name'
            })
        } else if (req.body.shopName.toLowerCase() == 'official store') {
            throw ({
                statusCode: 400,
                message: 'Invalid shop name'
            })
        } else {
            User.findOne({
                where: {
                    id: req.loggedUser.id
                }
            })
                .then(userData => {
                    if (userData.shopName) {
                        throw ({
                            statusCode: 400,
                            message: 'You cannot change your shop name'
                        })
                    } else {
                        return User.update({
                            shopName: req.body.shopName
                        }, {
                            where: {
                                id: req.loggedUser.id
                            },
                            returning: true
                        })
                    }
                })
                .then(updatedUser => {
                    res.status(200).json(updatedUser[1][0].dataValues)
                })
                .catch(err => {
                    next(err)
                })
        }
    }

    static getPurchases(req, res, next) {
        let purchaseInfo
        if (req.loggedUser.role == 'admin') {
            throw ({
                statusCode: 403,
                message: 'Unauthorized access'
            })
        } else {
            Purchase.findAll({
                where: {
                    UserId: req.loggedUser.id
                },
                include: [{ model: Product }]
            })
                .then(purchaseData => {
                    purchaseInfo = purchaseData
                    let forBuyerFind = []
                    purchaseData.forEach(element => {
                        forBuyerFind.push(User.findOne({
                            where: {
                                id: element.Product.UserId
                            }
                        }))
                    });
                    return Promise.all(forBuyerFind)
                })
                .then(userDatas => {
                    for (let i = 0; i < purchaseInfo.length; i++) {
                        purchaseInfo[i].dataValues.shop = userDatas[i].shopName
                    }
                    res.status(200).json(purchaseInfo)
                })
                .catch(err => {
                    next(err)
                })
        }
    }

    static getIncomes(req, res, next) {
        let target
        let incomeInfo
        if (req.loggedUser.role == 'admin') {
            target = {
                official: true
            }
        } else {
            target = {
                UserId: req.loggedUser.id
            }
        }
        User.findOne({
            where: {
                id: req.loggedUser.id
            }
        })
            .then(userData => {
                if (!userData.shopName) {
                    throw ({
                        statusCode: 400,
                        message: 'Please create a shop first'
                    })
                } else {
                    return Income.findAll({
                        where: target,
                        include: [{ model: Product }]
                    })
                }
            })
            .then(incomeData => {
                incomeInfo = incomeData
                let forBuyerFind = []
                incomeData.forEach(element => {
                    forBuyerFind.push(User.findOne({
                        where: {
                            id: element.buyer
                        }
                    }))
                });
                return Promise.all(forBuyerFind)
            })
            .then(userDatas => {
                for (let i = 0; i < incomeInfo.length; i++) {
                    incomeInfo[i].buyer = userDatas[i].email
                }
                res.status(200).json(incomeInfo)
            })
            .catch(err => {
                console.log(err, '<==========')
                next(err)
            })
    }

    static getUserInfo(req, res, next) {
        User.findOne({
            where: {
                id: req.loggedUser.id
            }
        })
        .then(userData => {
            let userInfo = {
                id: userData.id,
                name: userData.name,
                email: userData.email,
                address: userData.address,
                phone: userData.phone,
                role: userData.role,
                shopName: userData.shopName
            }
            res.status(200).json(userInfo)
        })
        .catch(err => {
            next(err)
        })
    }

    static getAllAdmins (req, res, next) {
        User.findAll({
            where: {
                role: 'admin'
            },
            exclude: ['password']
        })
        .then(adminList => {
            res.status(200).json(adminList)
        })
        .catch(err => {
            next(err)
        })
    }

}

module.exports = UserController