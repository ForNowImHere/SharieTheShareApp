const express = require('express');
const multer = require('multer');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Set up Multer storage for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Utility to read users from users.json
const readUsers = () => {
    try {
        const data = fs.readFileSync(path.join(__dirname, 'users.json'));
        return JSON.parse(data);
    } catch (error) {
        return []; // Return an empty array if the file doesn't exist or is empty
    }
};

// Utility to write users to users.json
const writeUsers = (users) => {
    fs.writeFileSync(path.join(__dirname, 'users.json'), JSON.stringify(users, null, 2));
};

// Files array (in-memory)
let files = [];

const findUserByEmail = (email) => {
    const users = readUsers();
    return users.find(u => u.email === email);
};

// Routes
// GET the login page or file management page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// User login route
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const users = readUsers();

    // Check for the user in the database
    const user = users.find(u => u.email === email);

    if (user && user.password === password) {
        res.json({ message: 'Login successful', user });
    } else {
        res.status(401).json({ message: 'Invalid credentials' });
    }
});

// User signup route
app.post('/api/signup', (req, res) => {
    const { email, password } = req.body;
    const users = readUsers();

    // Check if email already exists
    const existingUser = users.find(u => u.email === email);

    if (existingUser) {
        return res.status(400).json({ message: 'Email is already taken' });
    }

    // Add new user to the users array
    const newUser = { email, password };
    users.push(newUser);
    writeUsers(users); // Save the updated users list to users.json

    res.json({ message: 'Signup successful', user: newUser });
});

// File upload route
app.post('/api/upload', upload.single('file'), (req, res) => {
    const { file } = req;
    const { owner } = req.body;

    if (!file || !owner) {
        return res.status(400).json({ message: 'File and owner are required' });
    }

    const user = findUserByEmail(owner);
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // Add file data to the files array
    const fileInfo = {
        filename: file.filename,
        originalname: file.originalname,
        owner: owner,
        type: file.mimetype,
        public: false
    };

    files.push(fileInfo);
    res.json({ message: 'File uploaded successfully', file: fileInfo });
});

// Get list of files
app.get('/api/files', (req, res) => {
    const { email } = req.query;
    const userFiles = files.filter(file => file.public || file.owner === email);
    res.json({ files: userFiles });
});

// Toggle file privacy
app.post('/api/togglePrivacy', (req, res) => {
    const { filename, owner } = req.body;

    const file = files.find(f => f.filename === filename);
    if (!file || file.owner !== owner) {
        return res.status(403).json({ message: 'You can only modify your own files' });
    }

    file.public = !file.public;
    res.json({ message: `File privacy changed to ${file.public ? 'public' : 'private'}`, file });
});

// Delete a file
app.post('/api/deleteFile', (req, res) => {
    const { filename, owner } = req.body;

    const fileIndex = files.findIndex(f => f.filename === filename);
    if (fileIndex === -1) {
        return res.status(404).json({ message: 'File not found' });
    }

    const file = files[fileIndex];
    if (file.owner !== owner) {
        return res.status(403).json({ message: 'You can only delete your own files' });
    }

    files.splice(fileIndex, 1);
    fs.unlinkSync(path.join(__dirname, 'public', 'uploads', filename));
    res.json({ message: 'File deleted successfully' });
});

// Clear all files (only accessible by the admin)
app.post('/api/clearAll', (req, res) => {
    const { email } = req.body;

    // Only allow admin to clear all files
    if (email !== 'Admin@FontsFun.com') {
        return res.status(403).json({ message: 'Only admin can clear all files' });
    }

    files.forEach(file => {
        fs.unlinkSync(path.join(__dirname, 'public', 'uploads', file.filename));
    });

    files = []; // Clear the file array
    res.json({ message: 'All files have been cleared' });
});

// Serve public files directly
app.get('/uploads/:filename', (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(__dirname, 'public', 'uploads', filename);
    res.sendFile(filePath);
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
