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

// In-memory store fallback
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

// Cached connection for Serverless environments
let isConnected = false;
let connectingPromise: Promise<typeof mongoose> | null = null;

async function connectToDatabase() {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (connectingPromise) {
    return connectingPromise;
  }

  mongoose.set("bufferCommands", false);

  connectingPromise = mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 4000,
    connectTimeoutMS: 5000,
  }).then(async (m) => {
    isConnected = true;
    console.log("[SERVERLESS API] Connected to MongoDB Atlas");
    
    // Quick bootstrap if needed
    try {
      const CategoryModel = getModel("categories");
      const catCount = await CategoryModel.countDocuments();
      if (catCount === 0 && INITIAL_CATEGORIES.length > 0) {
        for (const cat of INITIAL_CATEGORIES) {
          await CategoryModel.create({
            name: cat.name,
            icon: cat.icon,
            fixedPrice: cat.fixedPrice || 0,
            isIndividualPricing: false,
            createdAt: new Date().toISOString()
          });
        }
      }

      const MenuItemModel = getModel("menuItems");
      const menuCount = await MenuItemModel.countDocuments();
      if (menuCount === 0 && INITIAL_MENU_ITEMS.length > 0) {
        for (const item of INITIAL_MENU_ITEMS) {
          await MenuItemModel.create({
            name: item.name,
            categoryId: item.categoryId,
            categoryIds: [item.categoryId],
            price: item.price || 0,
            description: item.description || "",
            imageUrl: item.imageUrl || "",
            visible: true,
            allergies: [],
            createdAt: new Date().toISOString()
          });
        }
      }

      const TableModel = getModel("tables");
      const tableCount = await TableModel.countDocuments();
      if (tableCount === 0) {
        for (let i = 1; i <= 10; i++) {
          await TableModel.create({
            name: `Table ${i}`,
            isActive: true,
            createdAt: new Date().toISOString()
          });
        }
      }
    } catch (bootstrapErr) {
      console.warn("[SERVERLESS API] Bootstrap skipped:", bootstrapErr);
    }

    return m;
  }).catch((err) => {
    isConnected = false;
    connectingPromise = null;
    console.warn("[SERVERLESS API] MongoDB connection failed, using in-memory store:", err.message || err);
    return mongoose;
  });

  return connectingPromise;
}

const app = express();

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Middleware to ensure DB connection attempt
app.use(async (_req, _res, next) => {
  try {
    await connectToDatabase();
  } catch (_e) {
    // Continue with in-memory fallback
  }
  next();
});

// SSE Clients for Serverless (or long-polling)
const sseClients = new Set<Response>();

function broadcastEvent(collection: string, action: string, data: any, id?: string) {
  const payload = JSON.stringify({ collection, action, data, id, timestamp: Date.now() });
  for (const client of sseClients) {
    try {
      client.write(`event: db_change\ndata: ${payload}\n\n`);
    } catch (_err) {
      sseClients.delete(client);
    }
  }
}

// 1. SSE Endpoint
app.get("/api/events", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  res.write(`event: connected\ndata: ${JSON.stringify({ status: "connected", mongo: isConnected })}\n\n`);
  sseClients.add(res);

  const intervalId = setInterval(() => {
    try {
      res.write(": keepalive\n\n");
    } catch {
      clearInterval(intervalId);
      sseClients.delete(res);
    }
  }, 15000);

  req.on("close", () => {
    clearInterval(intervalId);
    sseClients.delete(res);
  });
});

// 2. Health Endpoint
app.get("/api/health", async (_req: Request, res: Response) => {
  const state = mongoose.connection.readyState;
  res.json({
    status: "ok",
    mongoConnected: isConnected,
    dbState: state === 1 ? "connected" : "in-memory-fallback"
  });
});

// 3. List Collection
app.get("/api/data/:collection", async (req: Request, res: Response) => {
  const { collection: rawColName } = req.params;
  const colKey = rawColName.toLowerCase();

  if (isConnected && mongoose.connection.readyState === 1) {
    try {
      const Model = getModel(rawColName);
      const query: any = {};

      for (const [key, value] of Object.entries(req.query)) {
        if (key !== "_sort" && key !== "_order" && key !== "_limit") {
          query[key] = value;
        }
      }

      let q = Model.find(query);
      if (req.query._sort) {
        const sortField = req.query._sort as string;
        const sortOrder = req.query._order === "desc" ? -1 : 1;
        q = q.sort({ [sortField]: sortOrder });
      }
      if (req.query._limit) {
        q = q.limit(parseInt(req.query._limit as string, 10));
      }

      const docs = await q.exec();
      return res.json(docs.map(d => d.toJSON()));
    } catch (err) {
      console.warn(`[API GET /api/data/${rawColName}] Mongo error, using in-memory:`, err);
    }
  }

  // Fallback Store
  const store = inMemoryStore[colKey] || [];
  let filtered = [...store];

  for (const [key, value] of Object.entries(req.query)) {
    if (key !== "_sort" && key !== "_order" && key !== "_limit") {
      filtered = filtered.filter(item => String(item[key]) === String(value));
    }
  }

  res.json(filtered);
});

// 4. Get Single Document
app.get("/api/data/:collection/:id", async (req: Request, res: Response) => {
  const { collection: rawColName, id } = req.params;
  const colKey = rawColName.toLowerCase();

  if (isConnected && mongoose.connection.readyState === 1) {
    try {
      const Model = getModel(rawColName);
      let doc = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        doc = await Model.findById(id);
      }
      if (!doc) {
        doc = await Model.findOne({ id });
      }

      if (doc) {
        return res.json(doc.toJSON());
      }
    } catch (err) {
      console.warn(`[API GET /api/data/${rawColName}/${id}] Mongo error:`, err);
    }
  }

  const store = inMemoryStore[colKey] || [];
  const item = store.find(i => i.id === id || i._id === id);
  if (!item) {
    return res.status(404).json({ error: "Document not found" });
  }
  res.json(item);
});

// 5. Create Document
app.post("/api/data/:collection", async (req: Request, res: Response) => {
  const { collection: rawColName } = req.params;
  const colKey = rawColName.toLowerCase();
  const data = req.body;

  if (!data.id) {
    data.id = `${colKey}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
  }
  if (!data.createdAt) {
    data.createdAt = new Date().toISOString();
  }

  if (isConnected && mongoose.connection.readyState === 1) {
    try {
      const Model = getModel(rawColName);
      const newDoc = await Model.create(data);
      const json = newDoc.toJSON();
      broadcastEvent(rawColName, "create", json, json.id);
      return res.status(201).json(json);
    } catch (err) {
      console.warn(`[API POST /api/data/${rawColName}] Mongo insert error:`, err);
    }
  }

  if (!inMemoryStore[colKey]) {
    inMemoryStore[colKey] = [];
  }
  inMemoryStore[colKey].push(data);
  broadcastEvent(rawColName, "create", data, data.id);
  res.status(201).json(data);
});

// 6. Update Document
const handleUpdate = async (req: Request, res: Response) => {
  const { collection: rawColName, id } = req.params;
  const colKey = rawColName.toLowerCase();
  const updateData = req.body;
  updateData.updatedAt = new Date().toISOString();

  if (isConnected && mongoose.connection.readyState === 1) {
    try {
      const Model = getModel(rawColName);
      let updatedDoc = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        updatedDoc = await Model.findByIdAndUpdate(id, { $set: updateData }, { new: true, upsert: true });
      } else {
        updatedDoc = await Model.findOneAndUpdate({ id }, { $set: updateData }, { new: true, upsert: true });
      }

      if (updatedDoc) {
        const json = updatedDoc.toJSON();
        broadcastEvent(rawColName, "update", json, json.id || id);
        return res.json(json);
      }
    } catch (err) {
      console.warn(`[API UPDATE /api/data/${rawColName}/${id}] Mongo update error:`, err);
    }
  }

  if (!inMemoryStore[colKey]) {
    inMemoryStore[colKey] = [];
  }
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

app.patch("/api/data/:collection/:id", handleUpdate);
app.put("/api/data/:collection/:id", handleUpdate);

// 7. Delete Document
app.delete("/api/data/:collection/:id", async (req: Request, res: Response) => {
  const { collection: rawColName, id } = req.params;
  const colKey = rawColName.toLowerCase();

  if (isConnected && mongoose.connection.readyState === 1) {
    try {
      const Model = getModel(rawColName);
      if (mongoose.Types.ObjectId.isValid(id)) {
        await Model.findByIdAndDelete(id);
      } else {
        await Model.findOneAndDelete({ id });
      }
    } catch (err) {
      console.warn(`[API DELETE /api/data/${rawColName}/${id}] Mongo delete error:`, err);
    }
  }

  if (inMemoryStore[colKey]) {
    inMemoryStore[colKey] = inMemoryStore[colKey].filter(i => i.id !== id && i._id !== id);
  }

  broadcastEvent(rawColName, "delete", { id }, id);
  res.json({ success: true, id });
});

// 8. Print Endpoint (Cloud / Simulation on Serverless)
app.post("/api/print", async (req: Request, res: Response) => {
  const { order } = req.body;
  if (!order) {
    return res.status(400).json({ error: "Order data is required" });
  }

  console.log(`[SERVERLESS PRINT] Order received for printing: ${order.id || "new"}`);
  return res.json({ 
    success: true, 
    simulated: true, 
    message: "Print command received and processed successfully" 
  });
});

export default app;
