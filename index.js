const express = require('express')
const app = express()
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const cors = require('cors')
const port = process.env.PORT || 5000; 


app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rspxj2l.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 }); 

 
async function  run(){
    try{
            await client.connect();

            const serviceCollection = client.db('doctors_portal').collection('services')

            app.get('/services',async (req,res)=>{
                  const query = {};
                  const cursor = serviceCollection.find(query)
                  const result = await cursor.toArray()
                  res.send(result)
            })
    }
    finally{
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