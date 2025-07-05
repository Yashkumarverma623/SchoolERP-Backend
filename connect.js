const { MongoClient, ServerApiVersion } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/school-erp";


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function connectToDatabase() {
  try {
    await client.connect();
    
    await client.db("admin").command({ ping: 1 });
    
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    
    return client;
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    throw error;
  }
}

async function disconnectFromDatabase() {
  try {
    await client.close();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Error disconnecting from MongoDB:", error);
  }
}

async function run() {
  try {
    await connectToDatabase();
  } catch (error) {
    console.error("Connection test failed:", error);
  } finally {
    await disconnectFromDatabase();
  }
}

module.exports = {
  connectToDatabase,
  disconnectFromDatabase,
  client,
  run
};

if (require.main === module) {
  run().catch(console.dir);
}