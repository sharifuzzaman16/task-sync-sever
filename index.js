const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const WebSocket = require("ws");

dotenv.config();
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ki2z3.mongodb.net/?retryWrites=true&w=majority`;

async function run() {
    try {
        const client = new MongoClient(uri, {
            serverApi: {
                version: ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true,
            },
        });

        await client.connect();
        console.log("Connected to MongoDB Atlas!");
        const db = client.db("taskSyncDB");
        const tasksCollection = db.collection("tasks");

        // WebSocket connection for real-time updates
        // Backend WebSocket handler
        wss.on("connection", (ws) => {
            console.log("Client connected");

            ws.on("message", (message) => {
                const data = JSON.parse(message);

                if (data.type === "INITIAL_TASKS" && data.userEmail) {
                    // Fetch tasks for the specific user
                    tasksCollection.find({ userEmail: data.userEmail }).toArray().then((tasks) => {
                        ws.send(JSON.stringify({ type: "INITIAL_TASKS", data: tasks }));
                    });
                }
            });

            // Listen for changes in the tasks collection
            const changeStream = tasksCollection.watch([], { fullDocument: "updateLookup" });
            changeStream.on("change", (change) => {
                if (change.operationType === "insert") {
                    // Send new task to the client
                    ws.send(JSON.stringify({ type: "TASK_ADDED", data: change.fullDocument }));
                } else if (change.operationType === "update") {
                    // Send updated task to the client
                    ws.send(JSON.stringify({ type: "TASK_UPDATED", data: change.fullDocument }));
                } else if (change.operationType === "delete") {
                    // Send deleted task ID to the client
                    ws.send(JSON.stringify({ type: "TASK_DELETED", data: { _id: change.documentKey._id } }));
                }
            });

            ws.on("close", () => {
                console.log("Client disconnected");
                changeStream.close();
            });
        });

        // REST API endpoints
        app.get("/tasks", async (req, res) => {
            const userEmail = req.query.userEmail;
            if (!userEmail) {
                return res.status(400).json({ error: "User email is required" });
            }

            const query = { userEmail: userEmail }; // Filter tasks by userEmail
            try {
                const tasks = await tasksCollection.find(query).toArray();
                res.json(tasks);
            } catch (error) {
                console.error("Failed to fetch tasks:", error);
                res.status(500).json({ error: "Failed to fetch tasks" });
            }
        });

        app.post('/tasks', async (req, res) => {
            const task = req.body;
            try {
                const result = await tasksCollection.insertOne(task);
                res.send(result);
            } catch (error) {
                console.error("Failed to add task:", error);
                res.status(500).json({ error: "Failed to add task" });
            }
        });

        app.put("/tasks/:id", async (req, res) => {
            const { id } = req.params;
            const { title, description, category, priority, userEmail } = req.body;

            try {
                const taskId = new ObjectId(id);
                const task = await tasksCollection.findOne({ _id: taskId, userEmail: userEmail });

                if (!task) {
                    return res.status(404).json({ error: "Task not found" });
                }

                const updatedTask = {
                    title,
                    description,
                    category,
                    priority,
                };

                await tasksCollection.updateOne(
                    { _id: taskId },
                    { $set: updatedTask }
                );

                res.json({ message: "Task updated successfully", updatedTask });
            } catch (error) {
                console.error("Failed to update task:", error);
                res.status(500).json({ error: "Failed to update task" });
            }
        });

        app.delete("/tasks/:id", async (req, res) => {
            const taskId = req.params.id;
            const filter = { _id: new ObjectId(taskId) };
            try {
                const result = await tasksCollection.deleteOne(filter);
                if (result.deletedCount === 0) {
                    return res.status(404).json({ error: "Task not found" });
                }
                res.json({ message: "Task deleted successfully" });
            } catch (error) {
                console.error("Failed to delete task:", error);
                res.status(500).json({ error: "Failed to delete task" });
            }
        });

        app.get("/tasks/completed", async (req, res) => {
            const userEmail = req.query.userEmail;
            try {
                const completedTasks = await tasksCollection.find({
                    category: "Done",
                    userEmail: userEmail,
                }).toArray();
                res.json(completedTasks);
            } catch (error) {
                console.error("Error fetching completed tasks:", error);
                res.status(500).json({ error: "Failed to fetch completed tasks" });
            }
        });

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello World!');
});

server.listen(port, () => {
    console.log(`TaskSync is Syncing on port ${port}`);
});