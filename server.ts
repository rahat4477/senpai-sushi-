import express, { Response } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import escpos from "escpos";
import escposNetwork from "escpos-network";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { INITIAL_CATEGORIES, INITIAL_MENU_ITEMS } from "./src/constants";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://amailtorahat3_db_user:ScIvgXpMQB2uO7K2@cluster0.xvjqd0q.mongodb.net/restaurant_db?retryWrites=true&w=majority&appName=Cluster0";

// --- MongoDB Schemas & Dynamic Models ---
const genericSchema = new mongoose.Schema(
  {},
  { 
    strict: false, 
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

function getModel(collectionName: string) {
  // Normalize collection name
  const normalized = collectionName.toLowerCase();
  if (mongoose.models[normalized]) {
    return mongoose.models[normalized];
  }
  return mongoose.model(normalized, genericSchema, collectionName);
}

// In-memory fallback store to ensure zero-downtime and instant UI responses if MongoDB is waiting for IP whitelist
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
  ingredientcategories: []
};

// SSE Event Stream for Real-time Subscriptions
const sseClients = new Set<Response>();

function broadcastEvent(collection: string, action: string, data: any, id?: string) {
  const payload = JSON.stringify({ collection, action, data, id, timestamp: Date.now() });
  for (const client of sseClients) {
    try {
      client.write(`event: db_change\ndata: ${payload}\n\n`);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

// MongoDB Initialization & Bootstrapping
let isMongoConnected = false;

async function initMongoDB() {
  try {
    console.log("[SERVER] Connecting to MongoDB Atlas...");
    mongoose.set('bufferCommands', false); // Do not buffer operations infinitely when disconnected
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    isMongoConnected = true;
    console.log("[SERVER] Successfully connected to MongoDB Atlas!");

    // 1. Bootstrap Printers
    const PrinterModel = getModel("printers");
    const printerCount = await PrinterModel.countDocuments();
    if (printerCount === 0) {
      console.log("[SERVER] Bootstrapping default printer: Custom P3");
      await PrinterModel.create({
        name: "Custom P3",
        type: "thermal",
        serialNumber: "MECC2019222350530",
        macAddress: "000EE21A956E",
        port: 9100,
        isDefault: true,
        createdAt: new Date().toISOString()
      });
    }

    // 2. Bootstrap Categories
    const CategoryModel = getModel("categories");
    const categoryCount = await CategoryModel.countDocuments();
    if (categoryCount === 0 && INITIAL_CATEGORIES && INITIAL_CATEGORIES.length > 0) {
      console.log("[SERVER] Bootstrapping initial categories...");
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

    // 3. Bootstrap Menu Items
    const MenuItemModel = getModel("menuItems");
    const menuCount = await MenuItemModel.countDocuments();
    if (menuCount === 0 && INITIAL_MENU_ITEMS && INITIAL_MENU_ITEMS.length > 0) {
      console.log("[SERVER] Bootstrapping initial menu items...");
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

    // 4. Bootstrap Tables (1 to 10)
    const TableModel = getModel("tables");
    const tableCount = await TableModel.countDocuments();
    if (tableCount === 0) {
      console.log("[SERVER] Bootstrapping tables (1 to 10)...");
      for (let i = 1; i <= 10; i++) {
        await TableModel.create({
          name: `Table ${i}`,
          isActive: true,
          createdAt: new Date().toISOString()
        });
      }
    }

    // 5. Bootstrap Site Settings
    const SettingsModel = getModel("settings");
    const existingSiteSettings = await SettingsModel.findOne({ id: "site" });
    if (!existingSiteSettings) {
      await SettingsModel.create({
        id: "site",
        siteName: "Smart Menu & Kitchen",
        logo: "",
        favicon: "",
        contactEmail: "info@restaurant.com",
        contactPhone: "+39 123 456 7890",
        address: "Via Roma, 12, Milano",
        footerText: "Powered by Smart Menu",
        createdAt: new Date().toISOString()
      });
    }

    console.log("[SERVER] MongoDB data bootstrapping complete.");
  } catch (err) {
    console.warn("[SERVER] MongoDB Atlas is connecting or waiting for IP whitelist. Seamless in-memory store active.", err instanceof Error ? err.message : err);
    // Periodically retry connecting to Atlas in the background
    setTimeout(() => {
      if (!isMongoConnected) {
        initMongoDB().catch(() => {});
      }
    }, 15000);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "20mb" }));

  // --- Real-Time SSE Endpoint ---
  app.get("/api/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    // Send initial connected event
    res.write(`event: connected\ndata: ${JSON.stringify({ status: "connected", mongo: isMongoConnected })}\n\n`);
    sseClients.add(res);

    const intervalId = setInterval(() => {
      res.write(": keepalive\n\n");
    }, 20000);

    req.on("close", () => {
      clearInterval(intervalId);
      sseClients.delete(res);
    });
  });

  // --- Health Check Endpoint ---
  app.get("/api/health", async (req, res) => {
    try {
      const state = mongoose.connection.readyState;
      const states = ["disconnected", "connected", "connecting", "disconnecting"];
      const statusText = states[state] || "unknown";

      if (state === 1) {
        res.json({ status: "ok", message: "Connected to MongoDB Atlas", dbState: statusText });
      } else {
        res.status(503).json({ status: "error", message: `MongoDB state: ${statusText}` });
      }
    } catch (err) {
      res.status(500).json({ status: "error", message: err instanceof Error ? err.message : String(err) });
    }
  });

  // --- Generic MongoDB REST Endpoints for Collections with In-Memory Resiliency ---
  
  // 1. List / Query Collection
  app.get("/api/data/:collection", async (req, res) => {
    const { collection: rawColName } = req.params;
    const colKey = rawColName.toLowerCase();
    
    if (isMongoConnected) {
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
        console.warn(`[API GET /api/data/${rawColName}] Mongo read failed, falling back to local store:`, err);
      }
    }

    // In-Memory Fallback
    const store = inMemoryStore[colKey] || [];
    let filtered = [...store];

    for (const [key, value] of Object.entries(req.query)) {
      if (key !== "_sort" && key !== "_order" && key !== "_limit") {
        filtered = filtered.filter(item => String(item[key]) === String(value));
      }
    }

    res.json(filtered);
  });

  // 2. Get Single Document
  app.get("/api/data/:collection/:id", async (req, res) => {
    const { collection: rawColName, id } = req.params;
    const colKey = rawColName.toLowerCase();

    if (isMongoConnected) {
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
        console.warn(`[API GET /api/data/${rawColName}/${id}] Mongo fetch error:`, err);
      }
    }

    // In-Memory Fallback
    const store = inMemoryStore[colKey] || [];
    const item = store.find(i => i.id === id || i._id === id);
    if (!item) {
      return res.status(404).json({ error: "Document not found" });
    }
    res.json(item);
  });

  // 3. Create Document
  app.post("/api/data/:collection", async (req, res) => {
    const { collection: rawColName } = req.params;
    const colKey = rawColName.toLowerCase();
    const data = req.body;

    if (!data.id) {
      data.id = `${colKey}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
    }
    if (!data.createdAt) {
      data.createdAt = new Date().toISOString();
    }

    if (isMongoConnected) {
      try {
        const Model = getModel(rawColName);
        const newDoc = await Model.create(data);
        const json = newDoc.toJSON();
        broadcastEvent(rawColName, "create", json, json.id);
        return res.status(201).json(json);
      } catch (err) {
        console.warn(`[API POST /api/data/${rawColName}] Mongo insert failed, persisting in local store:`, err);
      }
    }

    // In-Memory Fallback
    if (!inMemoryStore[colKey]) {
      inMemoryStore[colKey] = [];
    }
    inMemoryStore[colKey].push(data);
    broadcastEvent(rawColName, "create", data, data.id);
    res.status(201).json(data);
  });

  // 4. Update Document (PATCH / PUT)
  const handleUpdate = async (req: express.Request, res: express.Response) => {
    const { collection: rawColName, id } = req.params;
    const colKey = rawColName.toLowerCase();
    const updateData = req.body;
    updateData.updatedAt = new Date().toISOString();

    if (isMongoConnected) {
      try {
        const Model = getModel(rawColName);
        let updatedDoc = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
          updatedDoc = await Model.findByIdAndUpdate(id, { $set: updateData }, { new: true, upsert: true });
        } else {
          updatedDoc = await Model.findOneAndUpdate({ id }, { $set: updateData }, { new: true, upsert: true });
        }

        const json = updatedDoc.toJSON();
        broadcastEvent(rawColName, "update", json, json.id || id);
        return res.json(json);
      } catch (err) {
        console.warn(`[API UPDATE /api/data/${rawColName}/${id}] Mongo update error:`, err);
      }
    }

    // In-Memory Fallback
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

  // 5. Delete Document
  app.delete("/api/data/:collection/:id", async (req, res) => {
    const { collection: rawColName, id } = req.params;
    const colKey = rawColName.toLowerCase();

    if (isMongoConnected) {
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

    // In-Memory Fallback
    if (inMemoryStore[colKey]) {
      inMemoryStore[colKey] = inMemoryStore[colKey].filter(i => i.id !== id && i._id !== id);
    }

    broadcastEvent(rawColName, "delete", { id }, id);
    res.json({ success: true, id });
  });

  // --- Printing Endpoint ---
  app.post("/api/print", async (req, res) => {
    const { order } = req.body;
    
    if (!order) {
      return res.status(400).json({ error: "Order data is required" });
    }

    console.log(`[PRINT] Processing request for order: ${order.id || "new"}`);

    try {
      const PrinterModel = getModel("printers");
      const printers = (await PrinterModel.find().exec()).map(d => d.toJSON());
      
      let printerToUse = printers.find((p: any) => p.isDefault);
      if (!printerToUse && printers.length > 0) {
        printerToUse = printers[0];
      }

      if (!printerToUse && process.env.PRINTER_IP) {
        printerToUse = {
          name: "Env Printer",
          ip: process.env.PRINTER_IP,
          port: parseInt(process.env.PRINTER_PORT || "9100", 10),
          type: "thermal"
        };
      }

      if (!printerToUse) {
        return res.status(404).json({ error: "No printer configured. Please add a printer in settings." });
      }

      console.log(`[PRINT] Using printer: ${printerToUse.name} (IP: ${printerToUse.ip || "N/A"})`);

      // LAN Printing (IP based)
      if (printerToUse.ip) {
        const device = new escposNetwork(printerToUse.ip, printerToUse.port || 9100);
        const printer = new escpos.Printer(device);

        return new Promise((resolve) => {
          device.open((error) => {
            if (error) {
              console.error("[PRINT] LAN connection error:", error);
              res.status(500).json({ error: "Could not connect to LAN printer", details: error.message });
              resolve(null);
              return;
            }

            try {
              printer
                .font("a")
                .align("ct")
                .style("bu")
                .size(1, 1)
                .text("Smart Restaurant")
                .size(0, 0)
                .text("--------------------------------")
                .align("lt")
                .text(`Table: ${order.tableName || order.tableNumber}`)
                .text(`Order ID: ${order.id ? order.id.substring(0, 8) : "N/A"}`)
                .text(`Time: ${new Date(order.createdAt || Date.now()).toLocaleString()}`)
                .text("--------------------------------");

              if (order.items && Array.isArray(order.items)) {
                order.items.forEach((item: any) => {
                  printer.text(`${item.name} x ${item.quantity} - €${(item.price * item.quantity).toFixed(2)}`);
                });
              }

              printer
                .text("--------------------------------")
                .align("rt")
                .text(`TOTAL: €${(order.total || 0).toFixed(2)}`)
                .align("ct")
                .text("Thank you for your order!")
                .feed(3)
                .cut()
                .close();
              
              console.log("[PRINT] LAN Print successful");
              res.json({ success: true });
              resolve(null);
            } catch (printErr) {
              console.error("[PRINT] Generation error:", printErr);
              res.status(500).json({ error: "Print generation error", details: String(printErr) });
              resolve(null);
            }
          });
        });
      } 
      
      if (printerToUse.serialNumber || printerToUse.macAddress) {
        console.log(`[PRINT] CLOUD/REMOTE: Initiating for SN: ${printerToUse.serialNumber || "N/A"}, MAC: ${printerToUse.macAddress || "N/A"}`);
        return res.json({ success: true, simulated: true, method: printerToUse.serialNumber ? "serial" : "mac" });
      }

      return res.status(400).json({ error: "Invalid printer config" });

    } catch (err) {
      console.error("[PRINT] Global failure:", err);
      res.status(500).json({ error: "Printing failed", details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Connect and bootstrap MongoDB in the background
    initMongoDB().catch((err) => console.error("[MONGODB] Init Error:", err));
  });
}

startServer();

