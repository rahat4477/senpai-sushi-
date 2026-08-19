import express, { Request, Response } from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { INITIAL_CATEGORIES, INITIAL_MENU_ITEMS } from "../src/constants";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://amailtorahat3_db_user:ScIvgXpMQB2uO7K2@cluster0.xvjqd0q.mongodb.net/restaurant_db?retryWrites=true&w=majority&appName=Cluster0";

const genericSchema = new mongoose.Schema(
  {},
  { 
    strict: false, 
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

function getModel(collectionName: string) {
  const normalized = collectionName.toLowerCase();
  if (mongoose.models[normalized]) {
    return mongoose.models[normalized];
  }
  return mongoose.model(normalized, genericSchema, collectionName);
}

const inMemoryStore: Record<string, any[]> = {
  categories: INITIAL_CATEGORIES.map((c, i) => ({
    id: `cat_${i + 1}`,
    name: c.name,
    icon: c.icon,
    fixedPrice: c.fixedPrice || 0,
    isIndividualPricing: false,
    createdAt: new Date().toISOString()
  })),
  menuitems: INITIAL_MENU_ITEMS.map((m, i) => ({
    id: `item_${i + 1}`,
    name: m.name,
    categoryId: m.categoryId,
    categoryIds: [m.categoryId],
    price: m.price || 0,
    description: m.description || "",
    imageUrl: m.imageUrl || "",
    visible: true,
    allergies: [],
    createdAt: new Date().toISOString()
  })),
  tables: Array.from({ length: 10 }, (_, i) => ({
    id: `table_${i + 1}`,
    name: `Table ${i + 1}`,
    isActive: true,
    createdAt: new Date().toISOString()
  })),
  printers: [{
    id: "printer_1",
    name: "Custom P3",
    type: "thermal",
    serialNumber: "MECC2019222350530",
    macAddress: "000EE21A956E",
    port: 9100,
    isDefault: true,
    createdAt: new Date().toISOString()
  }],
  settings: [{
    id: "site",
    siteName: "Smart Menu & Kitchen",
    logo: "",
    favicon: "",
    contactEmail: "info@restaurant.com",
    contactPhone: "+39 123 456 7890",
    address: "Via Roma, 12, Milano",
    footerText: "Powered by Smart Menu",
    createdAt: new Date().toISOString()
  }],
  orders: [],
  allergies: [],
  menugroups: [],
  ingredientcategories: [],
  customizationcategories: [],
  customizationlabels: [],
  staff: []
};

let isConnected = false;
let connectingPromise: Promise<typeof mongoose> | null = null;

async function connectToDatabase() {
  if (isConnected && mongoose.connection.readyState === 1) return mongoose;
  if (connectingPromise) return connectingPromise;

  mongoose.set("bufferCommands", false);

  connectingPromise = mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 4000,
    connectTimeoutMS: 5000,
  }).then(async (m) => {
    isConnected = true;
    console.log("[SERVERLESS API] Connected to MongoDB Atlas");
    return m;
  }).catch((err) => {
    isConnected = false;
    connectingPromise = null;
    console.warn("[SERVERLESS API] MongoDB fallback:", err.message || err);
    return mongoose;
  });

  return connectingPromise;
}

const app = express();
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Enable CORS
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

app.use(async (_req, _res, next) => {
  try { await connectToDatabase(); } catch (_e) {}
  next();
});

const sseClients = new Set<Response>();

function broadcastEvent(collection: string, action: string, data: any, id?: string) {
  const payload = JSON.stringify({ collection, action, data, id, timestamp: Date.now() });
  for (const client of sseClients) {
    try { client.write(`event: db_change\ndata: ${payload}\n\n`); } catch (_err) { sseClients.delete(client); }
  }
}

// Routes handling both with and without /api prefix
const handleHealth = async (_req: Request, res: Response) => {
  const state = mongoose.connection.readyState;
  res.json({ status: "ok", mongoConnected: isConnected, dbState: state === 1 ? "connected" : "in-memory-fallback" });
};
app.get("/health", handleHealth);
app.get("/api/health", handleHealth);

const handleEvents = (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write(`event: connected\ndata: ${JSON.stringify({ status: "connected", mongo: isConnected })}\n\n`);
  sseClients.add(res);

  const intervalId = setInterval(() => {
    try { res.write(": keepalive\n\n"); } catch { clearInterval(intervalId); sseClients.delete(res); }
  }, 15000);

  req.on("close", () => { clearInterval(intervalId); sseClients.delete(res); });
};
app.get("/events", handleEvents);
app.get("/api/events", handleEvents);

const handleGetList = async (req: Request, res: Response) => {
  const { collection: rawColName } = req.params;
  const colKey = rawColName.toLowerCase();

  if (isConnected && mongoose.connection.readyState === 1) {
    try {
      const Model = getModel(rawColName);
      const query: any = {};
      for (const [key, value] of Object.entries(req.query)) {
        if (key !== "_sort" && key !== "_order" && key !== "_limit") query[key] = value;
      }
      let q = Model.find(query);
      if (req.query._sort) q = q.sort({ [req.query._sort as string]: req.query._order === "desc" ? -1 : 1 });
      if (req.query._limit) q = q.limit(parseInt(req.query._limit as string, 10));
      const docs = await q.exec();
      return res.json(docs.map(d => d.toJSON()));
    } catch (err) {
      console.warn(`[API GET /data/${rawColName}] Mongo fallback:`, err);
    }
  }

  const store = inMemoryStore[colKey] || [];
  let filtered = [...store];
  for (const [key, value] of Object.entries(req.query)) {
    if (key !== "_sort" && key !== "_order" && key !== "_limit") {
      filtered = filtered.filter(item => String(item[key]) === String(value));
    }
  }
  res.json(filtered);
};
app.get("/data/:collection", handleGetList);
app.get("/api/data/:collection", handleGetList);

const handleGetSingle = async (req: Request, res: Response) => {
  const { collection: rawColName, id } = req.params;
  const colKey = rawColName.toLowerCase();

  if (isConnected && mongoose.connection.readyState === 1) {
    try {
      const Model = getModel(rawColName);
      let doc = mongoose.Types.ObjectId.isValid(id) ? await Model.findById(id) : await Model.findOne({ id });
      if (doc) return res.json(doc.toJSON());
    } catch (err) {
      console.warn(`[API GET /data/${rawColName}/${id}] Mongo error:`, err);
    }
  }

  const store = inMemoryStore[colKey] || [];
  const item = store.find(i => i.id === id || i._id === id);
  if (!item) return res.status(404).json({ error: "Document not found" });
  res.json(item);
};
app.get("/data/:collection/:id", handleGetSingle);
app.get("/api/data/:collection/:id", handleGetSingle);

const handlePost = async (req: Request, res: Response) => {
  const { collection: rawColName } = req.params;
  const colKey = rawColName.toLowerCase();
  const data = req.body;

  if (!data.id) data.id = `${colKey}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
  if (!data.createdAt) data.createdAt = new Date().toISOString();

  if (isConnected && mongoose.connection.readyState === 1) {
    try {
      const Model = getModel(rawColName);
      const newDoc = await Model.create(data);
      const json = newDoc.toJSON();
      broadcastEvent(rawColName, "create", json, json.id);
      return res.status(201).json(json);
    } catch (err) {
      console.warn(`[API POST /data/${rawColName}] Mongo insert fallback:`, err);
    }
  }

  if (!inMemoryStore[colKey]) inMemoryStore[colKey] = [];
  inMemoryStore[colKey].push(data);
  broadcastEvent(rawColName, "create", data, data.id);
  res.status(201).json(data);
};
app.post("/data/:collection", handlePost);
app.post("/api/data/:collection", handlePost);

const handleUpdate = async (req: Request, res: Response) => {
  const { collection: rawColName, id } = req.params;
  const colKey = rawColName.toLowerCase();
  const updateData = req.body;
  updateData.updatedAt = new Date().toISOString();

  if (isConnected && mongoose.connection.readyState === 1) {
    try {
      const Model = getModel(rawColName);
      let updatedDoc = mongoose.Types.ObjectId.isValid(id)
        ? await Model.findByIdAndUpdate(id, { $set: updateData }, { new: true, upsert: true })
        : await Model.findOneAndUpdate({ id }, { $set: updateData }, { new: true, upsert: true });

      if (updatedDoc) {
        const json = updatedDoc.toJSON();
        broadcastEvent(rawColName, "update", json, json.id || id);
        return res.json(json);
      }
    } catch (err) {
      console.warn(`[API UPDATE /data/${rawColName}/${id}] Mongo update error:`, err);
    }
  }

  if (!inMemoryStore[colKey]) inMemoryStore[colKey] = [];
  const idx = inMemoryStore[colKey].findIndex(i => i.id === id || i._id === id);
  if (idx !== -1) {
    inMemoryStore[colKey][idx] = { ...inMemoryStore[colKey][idx], ...updateData };
    const updated = inMemoryStore[colKey][idx];
    broadcastEvent(rawColName, "update", updated, id);
    return res.json(updated);
  } else {
    const newItem = { id, ...updateData };
    inMemoryStore[colKey].push(newItem);
    broadcastEvent(rawColName, "update", newItem, id);
    return res.json(newItem);
  }
};
app.patch("/data/:collection/:id", handleUpdate);
app.patch("/api/data/:collection/:id", handleUpdate);
app.put("/data/:collection/:id", handleUpdate);
app.put("/api/data/:collection/:id", handleUpdate);

const handleDelete = async (req: Request, res: Response) => {
  const { collection: rawColName, id } = req.params;
  const colKey = rawColName.toLowerCase();

  if (isConnected && mongoose.connection.readyState === 1) {
    try {
      const Model = getModel(rawColName);
      if (mongoose.Types.ObjectId.isValid(id)) await Model.findByIdAndDelete(id);
      else await Model.findOneAndDelete({ id });
    } catch (err) {
      console.warn(`[API DELETE /data/${rawColName}/${id}] Mongo delete error:`, err);
    }
  }

  if (inMemoryStore[colKey]) {
    inMemoryStore[colKey] = inMemoryStore[colKey].filter(i => i.id !== id && i._id !== id);
  }

  broadcastEvent(rawColName, "delete", { id }, id);
  res.json({ success: true, id });
};
app.delete("/data/:collection/:id", handleDelete);
app.delete("/api/data/:collection/:id", handleDelete);

const handlePrint = async (req: Request, res: Response) => {
  const { order } = req.body;
  if (!order) return res.status(400).json({ error: "Order data is required" });
  return res.json({ success: true, simulated: true, message: "Print signal processed successfully" });
};
app.post("/print", handlePrint);
app.post("/api/print", handlePrint);

export default app;
