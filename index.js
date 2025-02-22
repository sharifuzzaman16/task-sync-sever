const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ki2z3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        // await client.connect();


        const tasksCollection = client.db("taskSyncDB").collection("tasks");

        app.get("/tasks", async (req, res) => {
            const userEmail = req.query.userEmail;
            const query = { userEmail: userEmail };
            const tasks = await tasksCollection.find(query).toArray();
            res.json(tasks);
        });

        app.post('/tasks', async (req, res) => {
            const task = req.body;
            const result = await tasksCollection.insertOne(task);
            res.send(result);
        });

        app.put("/tasks/:id", async (req, res) => {
            const taskId = req.params.id;
            const updatedTask = req.body;

            if (!taskId || !updatedTask) {
                return res.status(400).json({ error: "Task ID and updated task data are required" });
            }

            const filter = { _id: new ObjectId(taskId) };
            const updateDoc = {
                $set: {
                    title: updatedTask.title,
                    description: updatedTask.description,
                    category: updatedTask.category,
                    priority: updatedTask.priority,
                },
            };

            const result = await tasksCollection.updateOne(filter, updateDoc);

            if (result.matchedCount === 0) {
                return res.status(404).json({ error: "Task not found" });
            }

            res.json({ message: "Task updated successfully", updatedTask: { _id: taskId, ...updatedTask } });
        });

        app.delete("/tasks/:id", async (req, res) => {
            const taskId = req.params.id;
        
            if (!taskId) {
                return res.status(400).json({ error: "Task ID is required" });
            }
        
            const filter = { _id: new ObjectId(taskId) };
            const result = await tasksCollection.deleteOne(filter);
        
            if (result.deletedCount === 0) {
                return res.status(404).json({ error: "Task not found" });
            }
        
            res.json({ message: "Task deleted successfully" });
        });



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`TaskSync is Syncing on port ${port}`)
})