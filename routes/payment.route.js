const express = require('express');
const router = express.Router();
const Stripe = require('stripe')('sk_test_51PKyZHIsdYrHJ88Z8E4XZIS2vQWgd1u3YA7kqRzwySrhJiUzc14DePzJWChpO3mNTDXDgMqoMovhlsAqDQ73ty0G00LA8VDaIx');
router.post('/', async (req, res) => {
    try {
    const session = await Stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: Object.values(req.body.cartDetails).map(item => ({
    price_data: {
    currency: "usd",
    product_data: {
    name: item.title,
    images:[item.image]
    },
    unit_amount: item.price * 100,
    },
    quantity: item.quantity,
    })),
    success_url: `${process.env.CLIENT_URL}`,
    cancel_url: `${process.env.CLIENT_URL}`,
    })
    res.json({ sessionId: session.id })
    } catch (e) {
    res.status(500).json({ error: e.message })
    }
    });
    module.exports = router;