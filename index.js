const express = require('express')
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const cors = require('cors')
const port = process.env.PORT || 5000;


app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rspxj2l.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJwt(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthrized access' })
    }
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' })
        }
        req.decoded = decoded;
        next();
    });
}


async function run() {
    try {
        await client.connect();

        const serviceCollection = client.db('doctors_portal').collection('services');
        const bookingCollection = client.db('doctors_portal').collection('booking');
        const userCollection = client.db('doctors_portal').collection('users');
        const doctorsCollection = client.db('doctors_portal').collection('doctors');


        //verifyADmin

        const verifyAdmin = async (req, res, next) => {
            const requester = req?.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next();
            }
            else {
                res.status(403).send({ message: 'Forbidden' });
            }
        }


        //admin api
        app.put('/users/admin/:email', verifyJwt, verifyAdmin, async (req, res) => {
            const email = req?.params.email;

            const filter = { email: email }
            const updateDoc = {
                $set: { role: 'admin' }
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        }


        )


        //admin api 
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email })
            const isAdmin = user.role === 'admin'
            res.send({ admin: isAdmin });
        })


        app.put('/users/:email', async (req, res) => {
            const email = req?.params.email;
            const user = req.body;
            const filter = { email: email }
            const options = { upsert: true };
            const updateDoc = {
                $set: user
            };

            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '100h'
            })
            res.send({ result, token });
        })

        app.get('/user', verifyJwt, async (req, res) => {
            const query = {};
            const cursor = userCollection.find(query);
            const result = await cursor.toArray();
            res.send(result)
        })

        //post payment api

        app.post('/create-paymant-intent', verifyJwt, async (req, res) => {
            const service = req.body;
            const price = service.price;
            const amount = price * 100;
            const paymentintent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card']
            })

            res.send({
                clientSecret: paymentintent.client_secret,
            });

        })


        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query).project({ name: 1 })
            const result = await cursor.toArray()
            res.send(result)
        })

        //booking 
        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { teatMentName: booking.teatMentName, date: booking.date, patient: booking.patient };

            const exists = await bookingCollection.findOne(query)
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            const result = await bookingCollection.insertOne(booking);
            return res.send({ success: true, result })
        })

        //get booking

        app.get('/mybooking', verifyJwt, verifyAdmin, async (req, res) => {
            const patient = req.query.patient;
            const decodedEmail = req?.decoded?.email

            if (patient === decodedEmail) {
                const query = { patient: patient }
                const booking = await bookingCollection.find(query).toArray();
                return res.send(booking)
            } else {
                res.status(403).send({ message: 'Forbidden Access' })
            }

        })


        // get boking one
        app.get('/booking/:id', verifyJwt, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const booking = await bookingCollection.findOne(query);
            res.send(booking);
        })



        //available

        app.get('/available', async (req, res) => {
            const date = req.query.date;
            const services = await serviceCollection.find().toArray();
            const query = { date: date };
            const booking = await bookingCollection.find(query).toArray();

            services.forEach(service => {
                const serviceBooking = booking.filter(book => book.teatMentName === service.name);
                const booked = serviceBooking.map(book => book.slot);
                const available = service.slots.filter(slot => !booked.includes(slot));

                service.slots = available;

            })

            res.send(services)
        })


        //add doctors
        app.post('/doctor', verifyJwt, async (req, res) => {
            const body = req.body;
            const result = await doctorsCollection.insertOne(body);
            res.send(result);
        })

        //get doctors

        app.get('/doctor', verifyJwt, verifyAdmin, async (req, res) => {
            const query = {};
            const cursor = await doctorsCollection.find(query).toArray();
            res.send(cursor)
        });

        app.delete('/doctor/:email', verifyJwt, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await doctorsCollection.deleteOne(query)
            res.send(result)
        })


    }
    finally {
        //client.close();
    }
}

run().catch(console.dir)


app.get('/', (req, res) => {
    res.send('Hello from doctors portals')
})

app.listen(port, () => {
    console.log(`doctors-portals listening on port ${port}`)
})