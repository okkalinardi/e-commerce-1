const { Cart, User, Product, Income, Purchase } = require('../models')

class CartController {
    static addToCart(req, res, next) {
        let {
            ProductId,
            qty
        } = req.body
        Product.findOne({
            where: {
                id: ProductId
            }
        })
        .then(productData => {
            if(!productData) {
                throw({
                    statusCode: 404,
                    message: 'Product not Found'
                })
            } else {
                return Cart.create({
                    ProductId,
                    status: 'Active',
                    qty,
                    UserId: req.loggedUser.id
                })
            }
        })
        .then(addedToCart => {
            res.status(201).json(addedToCart)
        })
        .catch(err => {
            next(err)
        })
    }

    static getCart(req, res, next) {
        Cart.findAll({
            where: {
                UserId: req.loggedUser.id
            },
            include: [{ model: Product }]
        })
        .then(userCart => {
            res.status(200).json(userCart)
        })
        .catch(err => {
            next(err)
        })
    }

    static checkOutItems(req, res, next) {
        let cartItems = []
        let forReturn
        req.body.cartItems.forEach(element => {
            cartItems.push(Cart.findOne({
                where: {
                    ProductId: element.Product.id,
                    UserId: req.loggedUser.id
                },
                include: [{ model: Product }]
            })
            )
        })
        Promise.all(cartItems)

        .then(result => {
            let cartItems2 = []
            cartItems = result
            result.forEach(element => {
                if(element.qty > element.Product.stock) {
                    throw({
                        statusCode: 400,
                        message: 'Insufficient stock'
                    })
                }
            })
            req.body.cartItems.forEach(element => {
                cartItems2.push(Cart.update({
                    status: 'CheckedOut',
                    paid_date: new Date()
                },{
                    where: {
                        ProductId: element.ProductId,
                        UserId: req.loggedUser.id
                    },
                    returning: true
                })
                )
            })
            return Promise.all(cartItems2)
        })
        .then(finalResult => {
            forReturn = finalResult
            let updatedStock = []
            cartItems.forEach(element => {
                let finalStock = element.Product.stock - element.qty
                updatedStock.push(Product.update({
                    stock: finalStock
                },{
                    where: {
                        id: element.ProductId
                    }
                })
                )
            })
            return Promise.all(updatedStock)
            
        })
        .then(stockUpdated => {
            res.status(200).json(forReturn)
        })
        .catch(err => {
            next(err)
        })
    }

    static confirmDelivery(req, res, next) {
        let today = new Date()
        let newPurchase
        let cartInfo
        Cart.findOne({
            where: {
                id: req.params.id
            },
            include: [{ model: Product }, { model: User, attributes: ['email'] }]

        })
        .then(CartData => {
            cartInfo = CartData
            return Purchase.create({
                UserId: req.loggedUser.id,
                ProductId: CartData.ProductId,
                qty: CartData.qty,
                finish_date: today
            })
        })
        .then(createdPurchase => {
            newPurchase = createdPurchase
            return Income.create({
                UserId: cartInfo.Product.UserId,
                ProductId: cartInfo.ProductId,
                qty: cartInfo.qty,
                buyer: cartInfo.UserId,
                finish_date: today
            })
        })
        .then(incomeCreated => {
            return Cart.destroy({
                where: {
                    id: req.params.id
                }
            })
        })
        .then(deletedCart => {
            res.status(200).json(newPurchase)
        })
        .catch(err => {
            console.log(err, '<==========ERROR');
            
            next(err)
        })
    }
}

module.exports = CartController