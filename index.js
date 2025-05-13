import TelegramBot from "node-telegram-bot-api";
import express from "express";
import cors from "cors";
import fs from "fs";
const token = "7050502766:AAHIh_t_mNmXmNN2vKkhK9Yg-IL_lhoETxo";

const bot = new TelegramBot(token, { polling: true });

bot.on("polling_error", (error) => {
  console.error(`Polling error: ${error.code} | ${error.message}`);
  process.exit(1);
});

const app = express();
app.use(express.json());
app.use(cors());
const orders = {};
const usersFile = "users.json";

// Load existing users
let users = {};
if (fs.existsSync(usersFile)) {
  users = JSON.parse(fs.readFileSync(usersFile));
}

function saveUsers() {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

bot.setMyCommands([
  { command: "/start", description: "Botni Ishga Tushirish" },
  { command: "/mahsulotlar", description: "Mahsulotlarni Ko'rish" },
]);

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const location = msg.location;

  if (text === "/start") {
    await bot.sendMessage(chatId, "Afiya Marketga xush kelibsiz!", {
      reply_markup: {
        keyboard: [
          [
            {
              text: "Mahsulotlarni ko'rish",
              web_app: { url: "https://afiya-liard.vercel.app/" },
            },
          ],
        ],
      },
    });
    return;
  }

  if (text === "/mahsulotlar") {
    await bot.sendMessage(chatId, "Barcha Mahsulotlarni Ko'rish", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Mahsulotlarni Ko'rish",
              web_app: { url: "https://afiya-omega.vercel.app" },
            },
          ],
        ],
      },
    });
    return;
  } else if (text && !orders[chatId]?.step) {
    await bot.sendMessage(
      chatId,
      "Quyidagi tugma orqali mahsulotlarni ko'rishingiz mumkin:",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Mahsulotlarni Ko'rish",
                web_app: {
                  url: "https://afiya-omega.vercel.app",
                },
              },
            ],
          ],
        },
      },
    );
    return;
  }

  if (msg.web_app_data?.data) {
    try {
      const rawData = msg.web_app_data.data;
      const data = JSON.parse(rawData);
      const products = data.products || data;

      const productList = products || [];

      let summary = "🛍 **Xaridingiz:**\n\n";
      let totalPrice = 0;

      productList.forEach((item) => {
        summary += `🔹 ${item.title} - ${item.quantity}x\n`;
        totalPrice += item.price * item.quantity;
      });

      summary += `\n💰 **Jami summa**: ${totalPrice.toLocaleString()} so'm`;
      orders[chatId] = { cart: products };

      // Empty cart check
      if (!Array.isArray(products)) {
        throw new Error("Noto'g'ri ma'lumot formati");
      }
      if (products.length === 0) {
        throw new Error("Savatingiz bo'sh!");
      }

      // Product validation
      if (products.some((item) => !item.price || !item.quantity)) {
        throw new Error("Noto'g'ri mahsulot formati");
      }
    } catch (error) {
      console.error("Web app error:", error);

      let errorMessage = "❌ Xatolik yuz berdi. Qayta urinib ko'ring.";

      if (error.message === "Savatingiz bo'sh!") {
        errorMessage = "🛒 Savatingiz bo'sh! Iltimos, avval mahsulot tanlang.";
      } else if (error.message === "Noto'g'ri mahsulot formati") {
        errorMessage =
          "⚠️ Mahsulot ma'lumotlarida xatolik. Iltimos, qayta tanlang.";
      }

      await bot.sendMessage(chatId, errorMessage, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🔄 Mahsulotlarni tanlash",
                web_app: { url: "https://afiya-kappa.vercel.app" },
              },
            ],
          ],
        },
      });

      return;
    }
  }

  // Modify the web app data handler
  if (msg.web_app_data?.data) {
    try {
      const rawData = msg.web_app_data.data;
      const data = JSON.parse(rawData);

      // Receive products from React app
      const products = data.products || [];

      // Validate products array
      if (!Array.isArray(products)) {
        throw new Error("Invalid products format");
      }

      // Now safely use products
      const productList = products || [];
      let summary = "🛍 **Xaridingiz:**\n\n";
      let totalPrice = 0;

      productList.forEach((item) => {
        summary += `🔹 ${item.title} - ${item.quantity}x\n`;
        totalPrice += item.price * item.quantity;
      });

      summary += `\n💰 **Jami summa**: ${totalPrice.toLocaleString()} so'm`;
      orders[chatId] = { cart: products };

      if (
        users[chatId]?.name &&
        users[chatId]?.phone &&
        users[chatId]?.location
      ) {
        const user = users[chatId];
        await bot.sendMessage(chatId, summary);
        await bot.sendMessage(
          chatId,
          `📌 *Oldingi ma'lumotlar*:\n👤 ${user.name}\n📞 ${user.phone}\n📍 ${user.location}\n\nTasdiqlash uchun tugmalardan foydalaning:`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "✅ Tasdiqlash", callback_data: "confirm_order" }],
                [{ text: "📝 O'zgartirish", callback_data: "change_info" }],
              ],
            },
          },
        );
      } else {
        orders[chatId].step = 1;
        await bot.sendMessage(chatId, summary);
        await bot.sendMessage(chatId, "📌 Iltimos, ismingizni kiriting:");
      }
    } catch (error) {
      console.error("Web app error:", error);
      await bot.sendMessage(
        chatId,
        "❌ Xatolik yuz berdi. Qayta urinib ko'ring.",
      );
    }
    return;
  }

  // User info collection steps
  if (orders[chatId]?.step === 1 && text) {
    orders[chatId].name = text;
    orders[chatId].step = 2;
    await bot.sendMessage(chatId, "📞 Telefon raqamingizni kiriting:");
    return;
  }

  if (orders[chatId]?.step === 2 && text) {
    orders[chatId].phone = text;
    orders[chatId].step = 3;
    await bot.sendMessage(chatId, "📍 Manzilingizni yuboring (text yoki GPS):");
    return;
  }

  if (orders[chatId]?.step === 3) {
    if (location) {
      orders[chatId].location = {
        latitude: location.latitude,
        longitude: location.longitude,
      };
    } else if (text) {
      orders[chatId].location = text;
    } else {
      await bot.sendMessage(chatId, "📍 Iltimos, manzilni to'g'ri kiriting.");
      return;
    }

    users[chatId] = {
      name: orders[chatId].name,
      phone: orders[chatId].phone,
      location: orders[chatId].location,
    };
    saveUsers();

    await bot.sendMessage(
      chatId,
      "✅ Ma'lumotlar saqlandi! Tasdiqlash uchun tugmani bosing.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Tasdiqlash", callback_data: "confirm_order" }],
          ],
        },
      },
    );
    delete orders[chatId].step;
  }
});

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const action = query.data;

  if (action === "confirm_order") {
    const user = users[chatId];
    const order = orders[chatId];

    // Validation check
    if (!user || !order?.cart || !user.name || !user.phone || !user.location) {
      await bot.sendMessage(
        chatId,
        "✅ Ma'lumotlaringiz tasdiqlandi. \n /start orqali qayta buyurtmani yangilashingizni so'raymiz!",
      );
      return;
    }

    // --- ORDER PROCESSING SHOULD BE HERE ---
    let orderText = `📦 Yangi buyurtma!\n\n👤 ${user.name}\n📞 ${user.phone}\n📍 ${user.location}\n\n🛍 Mahsulotlar:\n`;
    let total = 0;

    order.cart.forEach((item) => {
      orderText += `🔸 ${item.title} - ${item.quantity}x\n`;
      total += item.price * item.quantity;
    });

    orderText += `\n💰 Jami: ${total.toLocaleString()} so'm`;

    // Send to admin
    const adminId = 7760250344;
    await bot.sendMessage(adminId, orderText);

    if (typeof user.location === "object") {
      await bot.sendLocation(
        adminId,
        user.location.latitude,
        user.location.longitude,
        { live_period: 86400 },
      );
    } else {
      await bot.sendMessage(
        adminId,
        `📍 *Manzil*: ${user.location}\n🗺 [Xaritada ko'rish](https://maps.google.com/?q=${encodeURIComponent(user.location)})`,
        { parse_mode: "Markdown" },
      );
    }

    await bot.sendMessage(chatId, "✅ Buyurtma qabul qilindi!");
    delete orders[chatId];
  } // <-- Close confirm_order action block

  // Handle other actions like change_info
  if (action === "change_info") {
    // Preserve existing cart while resetting user info
    const existingCart = orders[chatId]?.cart || [];

    delete users[chatId];
    orders[chatId] = {
      cart: existingCart,
      step: 1,
    };

    await bot.sendMessage(chatId, "✏️ Yangi ismingizni kiriting:", {
      reply_markup: {
        remove_keyboard: true,
        force_reply: true,
      },
    });
  }
});

// Web endpoint
app.post("/web-data", async (req, res) => {
  try {
    const { queryID, products } = req.body;
    const total = products.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0,
    );

    await bot.answerWebAppQuery(queryID, {
      type: "article",
      id: queryID,
      title: "Buyurtma qabul qilindi",
      input_message_content: {
        message_text: `✅ Buyurtma tasdiqlandi!\nJami summa: ${total.toLocaleString()} so'm\nMahsulotlar: ${products.map((p) => `${p.title} (${p.quantity}x)`).join(", ")}`,
      },
    });
    res.status(200).json({});
  } catch (error) {
    console.error("Web-data error:", error);
    res.status(500).json({});
  }
});

app.listen(process.env.PORT || 8000, () => console.log("Server is running"));
