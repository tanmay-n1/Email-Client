const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const dotenv = require('dotenv').config();

const app = express();
const port = 3000;
let loggedIn = 0;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Connect to SQLite3 database
const db = new sqlite3.Database('emails.db');
const udb = new sqlite3.Database('users.db');

// Create Email table
db.run(`
    CREATE TABLE IF NOT EXISTS emails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        to_email TEXT,
        subject TEXT,
        message TEXT,
        timestamp TEXT
    )
`);

// Create Users table
udb.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        password TEXT
    )
`);

// udb.run("INSERT INTO users (username, password) VALUES ('omi','meatballs')")

// Serve the login page
app.get('/', (req, res) => {
    if(loggedIn == 0){
        res.sendFile(__dirname + '/login.html');
    }
    else {
        res.sendFile(__dirname + '/outbox.html');
    }
});

// Serve the login page
app.get('/outbox', (req, res) => {
    if(loggedIn == 0){
        res.sendFile(__dirname + '/login.html');
    }
    else {
        res.sendFile(__dirname + '/outbox.html');
    }
});

// Handle login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    udb.get('SELECT * FROM users WHERE username = ? and password = ?', [username, password], (err, row) => {
        if (err) {
            console.log(err)
        }

        if (!row) {
            console.log("Login failed");
            res.status(401).send('Invalid username or password');
            // res.json({ message: 'Login failed!' });
        }

        else {
            res.sendFile(__dirname + '/outbox.html');
            // res.json({ success: true, message: 'Login successful' });
            console.log("Login Successful");
            loggedIn = 1;
            // res.json(row);
        }
    });
});


// Logout function
app.get('/logmeout', (req, res) => {
    loggedIn = 0;
    console.log(loggedIn);
    console.log("Please log in")
    res.sendFile(__dirname + '/login.html');
});


// Serve the compose page
app.get('/compose', (req, res) => {
    res.sendFile(__dirname + '/compose.html');
});


// Handle POST request to send emails
app.post('/send-email', async (req, res) => {
    const { to, subject, text } = req.body;
    console.log(loggedIn);
  
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MY_EMAIL,
        pass: process.env.MY_PASSWORD,
      },
    });
  
    const mailOptions = {
      from: 'Tanmay <tanmaynedu@gmail.com>',
      to,
      subject,
      text,
    };

    // Send email
    if(loggedIn == 1){
        try {
            await transporter.sendMail(mailOptions);
            console.log('Email sent successfully!');
            res.sendFile(__dirname + '/outbox.html');
        } catch (error) {
            console.error(error);
            console.log('Error sending email');
        }
        storeEmail(to, subject, text)
    }
    else {
        console.log("Please log in")
        res.sendFile(__dirname + '/login.html');
    }

});

function storeEmail(to, subject, text){
    console.log('Saving email to Database');

    // Store email in the SQLite3 database
    db.run(
        "INSERT INTO emails (to_email, subject, message, timestamp) VALUES (?, ?, ?, datetime('now', 'localtime'))",
        [to, subject, text],
        (err) => {
            if (err) {
                // return res.status(500).send(err.toString());
                console.log("error saving to db")
            }

            // res.status(200).send('Email sent and stored successfully!');
        }
    );
}

// Route to get all sent emails
app.get('/get-sent-emails', (req, res) => {
    if(loggedIn == 0){
        console.log("Please log in")
        res.sendFile(__dirname + '/login.html');
    } else {
        db.all('SELECT * FROM emails', (err, rows) => {
            if (err) {
                return res.status(500).send(err.toString());
            }
            else{
                res.json(rows);
            }
            
        });
    }
});

// Route to get a single email by ID
app.get('/email/:id', (req, res) => {
    const emailId = req.params.id;

    if(loggedIn == 0){
        console.log("Please log in")
        res.sendFile(__dirname + '/login.html');
    } else {
        db.get('SELECT * FROM emails WHERE id = ?', [emailId], (err, row) => {
            if (err) {
                return res.status(500).send(err.toString());
            }

            if (!row) {
                return res.status(404).json({ message: 'Email not found' });
            }

            else {
                res.json(row);
            }
        });
    }
});


   // Route to delete selected emails
   app.delete('/delete-emails', (req, res) => {
    const emailIds = req.body.emailIds;

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
        return res.status(400).json({ message: 'Invalid request. Please provide valid email IDs.' });
    }

    const placeholders = emailIds.map(() => '?').join(',');
    const query = `DELETE FROM emails WHERE id IN (${placeholders})`;

    db.run(query, emailIds, (err) => {
        if (err) {
            return res.status(500).send(err.toString());
        }

        res.json({ message: 'Selected emails deleted successfully!' });
    });
});

// Debugging
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    console.log(process.env.MY_EMAIL);
  });