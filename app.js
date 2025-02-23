// Import dependencies
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer'); // File upload
const http = require('http'); // HTTP for socket.io
const socketIo = require('socket.io'); // Real-time updates
const session = require('express-session'); // Session management
const { nanoid } = require('nanoid'); // Generate unique codes
const axios = require('axios'); // HTTP requests
const Product = require('./models/products'); 
const LoginData = require('./models/loginData'); // Import login schema
const UserData = require('./models/userData'); // Import user schema
const ItemOrder = require('./models/ItemOrder');
const fs = require('fs');
const { Binary } = require('mongodb');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server); // Set up Socket.io

// Middleware to parse JSON and URL-encoded form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Secure cookies only in production
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
}));

// Serve static files from the "public" directory
app.use(express.static('public'));

// Set EJS as the templating engine
app.set('view engine', 'ejs');

// Multer setup for file uploads (in-memory storage for product images)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch((err) => console.error('❌ Error connecting to MongoDB:', err));

// Import webhook handler
app.use('/webhook', require('./webhook'));

// Define routes for static HTML pages
const staticPages = [
    { route: '/', file: 'index.html' },
    { route: '/register', file: 'register.html' },
    { route: '/contact', file: 'contact.html' },
    { route: '/referral', file: 'referral.html' },
    { route: '/admin-in', file: 'admin-in.html' },
    { route: '/checkout', file: 'checkout.html' },
];

staticPages.forEach(({ route, file }) => {
    app.get(route, (req, res) => {
        res.sendFile(path.join(__dirname, 'public', file));
    });
});

// 🔹 **Modified GET /login Route (Redirects Logged-in Users)**
app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/home'); // Redirect if already logged in
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 🔹 **Login Route**
app.post('/login', async (req, res) => {
    try {
        const { phone, pin } = req.body;

        // Validate input
        if (!phone || !pin) {
            return res.status(400).json({ error: "Phone and PIN are required" });
        }

        // Check if user exists in LoginData collection
        const userLogin = await LoginData.findOne({ phone, pin });
        if (!userLogin) {
            return res.status(401).json({ error: "Invalid phone or PIN" });
        }
        
        // Retrieve user data from UserData collection where phone matches
        const userData = await UserData.findOne({ phone: userLogin.phone });
        if (!userData) {
            return res.status(404).json({ error: "User data not found" });
        }

        // Store user data in session
        req.session.user = userData;
        
        // Send JSON response
        res.status(200).json({ message: "Login successful" });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 🔹 **Home Route (Only Accessible When Logged In)**
app.get('/home', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login'); // Redirect to login if not logged in
    }

    // Retrieve user data from session
    const { realName, code, link, balance, message } = req.session.user;

    res.render('home', { realName, code, link, balance, message });
});

// 🔹 **Logout Route**
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login'); // Redirect to login page
    });
});

// 🔹 **New API Route to Check Session Status**
app.get('/check-session', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true });
    } else {
        res.json({ loggedIn: false });
    }
});

// 🔹 **Fetch Products API**
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find();

        const formattedProducts = products.map(product => ({
            _id: product._id,
            description: product.description,
            price: `Ksh ${product.price}`, // Format price
            quantity: product.quantity,
            contentType: product.contentType,
            image: product.image ? product.image.toString('base64') : null // Convert Binary to Base64
        }));

        res.json(formattedProducts);
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).send('Error fetching products');
    }
});

app.post('/register', async (req, res) => {
    try {
        const { phone, pin, realName } = req.body;

        // Validate input
        if (!phone || !pin || !realName) {
            return res.redirect('/register?error=All fields are required');
        }
        
        if (!/^(01|07)\d{8}$/.test(phone)) {
            return res.redirect('/register?error=Invalid phone number! Must start with 01 or 07 and be 10 digits long.');
        }

        if (pin.length !== 4 || isNaN(pin)) {
            return res.redirect('/register?error=Invalid PIN! Must be a 4-digit number.');
        }

        // Check if phone number already exists
        const existingUser = await LoginData.findOne({ phone });
        if (existingUser) {
            return res.redirect('/register?error=Phone number already registered');
        }

        // Save phone and PIN to LoginData collection
        const newLogin = new LoginData({ phone, pin });
        await newLogin.save();

        // Generate unique code
        const code = nanoid(6);
        const link = 'ma-store.onrender.com/';
        const message = `Use this link '${link}' to buy milk plus other products and don't forget to use my code '${code}' in the invite code section.`;
        const balance = 0;

        // Save user details in UserData collection
        const newUser = new UserData({ phone, realName, code, link, balance, message });
        await newUser.save();

        // Redirect to login page with success message
        res.redirect('/login?success=Registration successful! Please log in.');
    } catch (error) {
        console.error('Error registering user:', error);
        res.redirect('/register?error=An error occurred. Please try again.');
    }
});

// 🔹 **Submit Order Route (Handles Checkout Submission)**
app.post('/submit-order', async (req, res) => {
    try {
        console.log("Received Order Data:", req.body);

        let { message, msisdn, amount, refCode } = req.body;

        if (!message || !msisdn || !amount || !refCode) {
            return res.status(400).json({ error: "All fields are required." });
        }

        // Convert phone number format
        if (msisdn.startsWith('0')) {
            msisdn = '254' + msisdn.slice(1);
        }

        // Save order in MongoDB
        const newOrder = new ItemOrder({ message, msisdn, amount, refCode });
        await newOrder.save();

        // API Data
        const apiData = {
            api_key: 'MFpXSFJMRzg6bGt1NHN5dHQ=',
            email: 'michaeltemu20@gmail.com',
            account_id: 'UMPAY272723322',
            amount: amount.toString(),  // Ensure it's a string
            msisdn: msisdn,  // Ensure correct phone format
            reference: refCode
        };

        console.log('Sending API request with data:', apiData);

        // Send request to UmeskiaSoftwares API
        const apiResponse = await axios.post('https://api.umeskiasoftwares.com/api/v1/intiatestk', apiData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log("API Response:", apiResponse.status, apiResponse.data);

        res.status(200).json({ message: "Order submitted successfully. Enter PIN to confirm your purchase!" });

    } catch (error) {
        if (error.response) {
            console.error("API Error:", error.response.status, error.response.data);
        } else {
            console.error("Error:", error.message);
        }
        res.status(500).json({ error: "Error submitting order. Please check and try again." });
    }
});



// Handle Socket.io connections for real-time updates
io.on('connection', (socket) => {
    console.log('A user connected');

    // Send real-time updates when a new product is added
    socket.on('add-product', (product) => {
        io.emit('new-product', product);  // Emit 'new-product' event to all clients
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

app.post('/update-product', upload.single('image'), async (req, res) => {
    try {
        const { password, description, price, quantity } = req.body;

        // Admin password verification
        const adminPassword = process.env.ADMIN_PASSWORD || "yourAdminPassword";
        if (password !== adminPassword) {
            return res.status(403).json({ error: "Invalid admin password." });
        }

        // Validate input fields
        if (!description || !price || !quantity) {
            return res.status(400).json({ error: "All fields are required." });
        }

        // Check if an image file is uploaded
        let imageBinary = null;
        let contentType = null;

        if (req.file) {
            imageBinary = Binary.createFromBase64(req.file.buffer.toString('base64'));
            contentType = req.file.mimetype;
        }

        // Update product in MongoDB
        const updatedProduct = await Product.findOneAndUpdate(
            { description }, // Assuming description is unique for simplicity
            {
                price,
                quantity,
                image: imageBinary,
                contentType: contentType
            },
            { new: true, upsert: true }
        );

        res.status(200).json({ message: "Product updated successfully!", product: updatedProduct });

    } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({ error: "Error updating product. Please try again." });
    }
});

// Start server with Socket.io
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});