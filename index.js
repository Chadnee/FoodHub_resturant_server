const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.PAYMENT_SECRET)

app.use(cors());
app.use(express.json());

// function verifyjwt(req, res, next) {

//   // form the client side 
//   const authorization = req.headers.authorization
//   console.log({ Authorization: authorization });
//   // check the authorization here or not 
//   if (!authorization) {
//       return res.status(401).send({ err: "access denied" })
//   }

//   // split the token 
//   const token = authorization.split(' ')[1]

//   // verify the token token is valide or not 
//   jwt.verify(token, process.env.JWT_TOKEN, (err, decoded) => {
//       if (err) {
//           return res.status(403).send({ err: "access not valid" })
//       }

//       // here is the email form the clint side 
//       req.decoded = decoded

//       // then go to the next step 
//       next()
//     })



// }
const verifyJWT = (req, res, next) => {
  console.log(req.headers)
  const authorization = req.headers.authorization;
  console.log("authorization", authorization)
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized problem' });
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}

// const verifyJWT = (req, res, next) => {
//   const authorization = req.headers.authorization;
//   if (!authorization){
//     return res.status(401).send({error: true, message: "unauthorized access"});
//   }

//   //bearer token
//   const token = authorization.split(' ')[1];
//   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
//     if(err){
//       return res.status(401).send({ error: true, message:"unauthorized access"})
//     }
//     req.decoded = decoded;
//     next();
//   })
// }

app.get('/', (req, res) => {
  res.send('food is coocking')
})



const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.PASS_DB}@cluster0.jxd6utg.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const menuCollection = client.db("foodDB").collection("menuCollection");
    const reviewCollection = client.db("foodDB").collection("reviewCollection");
    const cartsCollection = client.db("foodDB").collection("cartsCollection");
    const usersCollection = client.db("foodDB").collection("usersCollection");
    const paymentsCollection = client.db("foodDB").collection("paymentsCollection");

    //jwt

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token })
    })

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      console.log(req.decoded)
      const query = { email: email }
      console.log("email", query);
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res.status(403).send({ error: true, message: "Unauthorized occurance" })
      }
      next()
    }

    app.get('/menu', async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    })

    app.post('/menu', verifyJWT, verifyAdmin, async (req, res) => {
      const newItem = req.body;
      const result = await menuCollection.insertOne(newItem);
      res.send(result);
    })

    app.delete('/menu/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      console.log(query);
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    })
    
    //review
    app.get('/review', async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    })
    
    app.post('/reviewAdded', async(req, res)=> {
        const params = req.body;
        const result = await reviewCollection.insertOne(params);
        res.send(result);
    })

    app.get('/reviewAdded', async(req, res)=> {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    })
    

    //carts
    app.get('/carts', async (req, res) => {
      const email = req.query.email;
      
      if (!email) {
        res.send([]);
      }
      
      // const decodedEmail = req.decoded.email;
      // if(email !== decodedEmail){
      //   return res.status(403).send({error: true, message: "forbidden access"})
      // }
      const query = { email: email };
      const result = await cartsCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/carts', async (req, res) => {
      const item = req.body;
      console.log(item)
      const result = await cartsCollection.insertOne(item);
      res.send(result)
    })

    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      console.log(query)
      const result = await cartsCollection.deleteOne(query);
      res.send(result)
    })
    app.get('/manage-bookings', verifyJWT, verifyAdmin, async(req, res) => {
      const result = await cartsCollection.find().toArray();
      res.send(result);
    })

    app.delete('/manage-bookings/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    })

    //create payment intent

    app.get("/carts/myPayment/:id", async(req, res) => {
       const id = req.params.id;
       const query = {_id: new ObjectId(id)};
       const result = await cartsCollection.findOne(query);
       res.send(result);
    })

    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      console.log(price, amount)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    app.post('/payments/:id', async (req, res) => {
      const id = req.params.id
      const payment = req.body;
      //const  postQuery = {_id: new ObjectId(id)}
      console.log(payment)
      //console.log(payment);
      const insertResult = await paymentsCollection.insertOne(payment)
        console.log(insertResult)

        await cartsCollection.updateOne(
          {_id: new ObjectId(id)},
          {$set: {status: 'payment_completed', 
                payment_date: new Date()},
             
            }
        );

        //for delete all payments together
      //const query = { menuItemId: { $in: payment.menuItems.map(id => id) } }
       
      //for delete individual payment
      // const deleteQuery = {_id: new ObjectId(id)}
      // const deleteResult = await cartsCollection.deleteOne(deleteQuery)
      //res.send({ insertResult, deleteResult });
      res.send(insertResult)
      
    })

    app.get('/payments/:id', verifyJWT, async (req, res) => {
      const result = await paymentsCollection.findOne().toArray()
      res.send(result);
    })

    //AdminHome

    app.get('/admin-stats', async (req, res) => {
      const users = await usersCollection.estimatedDocumentCount();

      const products = await menuCollection.estimatedDocumentCount();
      const orders = await paymentsCollection.estimatedDocumentCount();

      const payments = await paymentsCollection.find().toArray();
      const revenue = payments.reduce((sum, payment) => sum + payment.price, 0)

      res.send({
        users,
        products,
        orders,
        revenue
      })
    })

    app.get('/order-stats', verifyJWT, verifyAdmin, async (req, res) => {

      const pipeline = [
        {
          $unwind: '$menuItems'
        },
        {
          $lookup: {
            from: 'menuCollection',
            localField: 'menuItems',
            foreignField: '_id',
            as: 'menuDetails'
          }
        },
        {
          $unwind: '$menuDetails'
        },
        {
          $group: {
            _id: '$menuDetails.category',
            itemCount: { $sum: 1 },
            totalCategoryPrice: { $sum: '$menuDetails.price' }
          }
        },
        {
          $project: {
            _id: 0,
            category: '$_id',
            itemCount: 1,
            total: { $round: ['$totalCategoryPrice', 2] }
          }
        }
      ];



      const result = await paymentsCollection.aggregate(pipeline).toArray()
      console.log(result)
      res.send(result);
    })

    //UserHome

    app.get('/booking-stats', async (req, res) => {

      const pipeline = [
        {
          $lookup: {
            from: 'cartsCollection',
            localField: 'email',
            foreignField: 'email',
            as: 'bookingName'
          }
        },
        {
          $unwind: '$bookingName'
        },
        {
          $group: {
            _id: '$bookingName.email',
            bookingCount: { $sum: 1 },
            totalPrice: { $sum: '$bookingName.price' }

          }
        },
        {
          $project: {
            _id: 0,
            email: '$_id',
            bookingCount: 1,
            totalPrice: { $round: ['$totalPrice', 2] }
          }
        }
      ]
      const result = await usersCollection.aggregate(pipeline).toArray();
      res.send(result);
    })

    //payment-stats
    app.get('/payment-stats', async (req, res) => {
      const pipeline = [
        {
          $lookup: {
            from: 'paymentsCollection',
            localField: 'email',
            foreignField: 'email',
            as: 'paymentsName'
          }
        },

        {
          $unwind: '$paymentsName'
        },

        {
          $group: {
            _id: '$paymentsName.email',
            paymentsQuantity: { $sum: '$paymentsName.quantity' },
            totalPrice: { $sum: '$paymentsName.price' }
          }
        },
        {
          $project: {
            _id: 0,
            email: '$_id',
            paymentsQuantity: 1,
            totalPrice: { $round: ['$totalPrice', 2] }
          }
        }
      ]
      const result = await usersCollection.aggregate(pipeline).toArray();
      res.send(result);
    })

    //users

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);
      console.log("existing user:", existingUser)
      if (existingUser) {
        return res.send({ message: "user allready exist" })
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })

    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })
    //verifyJWT,
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin"
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);

    })

    app.delete("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    })

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      // if(req.decoded.email !== email){
      //   return res.send({ admin: false })
      // }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" }
      console.log("admin")
      res.send(result);
    })
//payments part
    app.get("/payment-history/:email", async(req, res) => {
      const userEmail = req.params.email;
      if (!userEmail) {
        res.send([]);
      }
      console.log(userEmail)
      // const query = {email: email};
      // const result = await paymentsCollection.findOne(query)
      const result = await paymentsCollection.find({email: userEmail }).toArray();
      res.send(result)
    })



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, () => {
  console.log(`Food-hub is ruuning on port ${port}`)
})

/**
 *   const decodedEmail = req.decoded.email;
      if(email !== decodedEmail){
        return res.status(403).send({error: true, message: "porviden access"})
      }
 */