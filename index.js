

// // app.use(cors({
// //   origin: [
// //     'https://theater-booking-front-end.vercel.app',
// //     'http://localhost:3000',
// //     'http://localhost:5173'
// //   ]
// // }));
// app.use(cors());
// // app.options('*', cors());



//Rebuild trigger for render
const express = require("express")
const path = require("path")
const cors = require("cors")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")

const { open } = require("sqlite")
const sqlite3 = require("sqlite3")

const app = express()
app.use(express.json())
app.use(cors())

const dbpath = path.join(__dirname, "database.db")
const JWT_SECRET = process.env.JWT_SECRET || "cinebook_secret_key_change_in_prod"
const SALT_ROUNDS = 10

let db = null

const initializeDbAndServer = async () => {
    try {
        db = await open({
            filename: dbpath,
            driver: sqlite3.Database
        })
        await createUsersTable()
        await tablecreation()
        await theaterUpdateTableCreation()
        app.listen(3000, () => { console.log("Server Running at http://localhost:3000/") })
    } catch (e) {
        console.log("Db error " + e.message)
        process.exit(1)
    }
}

initializeDbAndServer()

// ─── TABLE CREATION ──────────────────────────────────────────────────────────

// Users table (new)
const createUsersTable = async () => {
    const sql = `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`
    await db.exec(sql)
}

// Bookings table
const tablecreation = async () => {
    const sql = `CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        start_time TEXT,
        seat_No TEXT,
        status TEXT DEFAULT 'AVAILABLE',
        location TEXT,
        theater_name TEXT,
        movie_name TEXT,
        time TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`
    await db.exec(sql)
}

// Theater table
const theaterUpdateTableCreation = async () => {
    const sql = `CREATE TABLE IF NOT EXISTS Theater (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        location TEXT,
        theater_name TEXT,
        time TEXT,
        movie_name TEXT,
        movie_img TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`
    await db.exec(sql)
}

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────

// Verifies JWT and attaches user to request
const authenticateToken = (request, response, next) => {
    const authHeader = request.headers["authorization"]
    const token = authHeader && authHeader.split(" ")[1] // Bearer <token>

    if (!token) {
        return response.status(401).json({ error: "Access token required" })
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return response.status(403).json({ error: "Invalid or expired token" })
        }
        request.user = user
        next()
    })
}

// ─── AUTH ROUTES ─────────────────────────────────────────────────────────────

// POST /register  — create a new user
app.post("/register", async (request, response) => {
    try {
        const { username, email, password } = request.body

        // Validate required fields
        if (!username || !email || !password) {
            return response.status(400).json({ error: "username, email and password are required" })
        }
        if (password.length < 6) {
            return response.status(400).json({ error: "Password must be at least 6 characters" })
        }

        // Check if username already exists
        const existingUser = await db.get(
            `SELECT id FROM users WHERE username = ? OR email = ?`,
            [username, email]
        )
        if (existingUser) {
            return response.status(409).json({ error: "Username or email already taken" })
        }

        // Hash password and insert
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)
        const result = await db.run(
            `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`,
            [username, email, hashedPassword]
        )

        // Issue JWT
        const token = jwt.sign(
            { id: result.lastID, username, email },
            JWT_SECRET,
            { expiresIn: "7d" }
        )

        response.status(201).json({
            message: "Account created successfully",
            token,
            user: { id: result.lastID, username, email }
        })
    } catch (e) {
        console.log("Register error:", e.message)
        response.status(500).json({ error: "Registration failed. Please try again." })
    }
})

// POST /login  — sign in with username + password
app.post("/login", async (request, response) => {
    try {
        const { username, password } = request.body

        if (!username || !password) {
            return response.status(400).json({ error: "Username and password are required" })
        }

        // Find user
        const user = await db.get(
            `SELECT * FROM users WHERE username = ?`,
            [username]
        )
        if (!user) {
            return response.status(401).json({ error: "Invalid username or password" })
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch) {
            return response.status(401).json({ error: "Invalid username or password" })
        }

        // Issue JWT
        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email },
            JWT_SECRET,
            { expiresIn: "7d" }
        )

        response.json({
            message: "Login successful",
            token,
            user: { id: user.id, username: user.username, email: user.email }
        })
    } catch (e) {
        console.log("Login error:", e.message)
        response.status(500).json({ error: "Login failed. Please try again." })
    }
})

// GET /me  — get current logged-in user info (protected)
app.get("/me", authenticateToken, async (request, response) => {
    try {
        const user = await db.get(
            `SELECT id, username, email, created_at FROM users WHERE id = ?`,
            [request.user.id]
        )
        if (!user) return response.status(404).json({ error: "User not found" })
        response.json(user)
    } catch (e) {
        response.status(500).json({ error: e.message })
    }
})

// ─── BOOKING ROUTES ───────────────────────────────────────────────────────────

// POST /seatbooking/  — book a seat (protected: must be logged in)
app.post("/seatbooking/", authenticateToken, async (request, response) => {
    try {
        const { start_time, seat_No, status, location, theater_name, movie_name } = request.body
        const user_id = request.user.id  // taken from JWT, not request body
        const query = `INSERT INTO bookings(user_id, start_time, seat_No, status, location, theater_name, movie_name)
                       VALUES (?, ?, ?, ?, ?, ?, ?)`
        await db.run(query, [user_id, start_time, seat_No, status, location, theater_name, movie_name])
        response.json({ message: "Seat booked successfully" })
    } catch (e) {
        response.status(500).json({ error: e.message })
    }
})

// GET /booked/  — get all bookings
app.get("/booked/", async (request, response) => {
    try {
        const query = `SELECT * FROM bookings`
        const alldetails = await db.all(query)
        response.json(alldetails)
    } catch (e) {
        response.status(500).json({ error: e.message })
    }
})

// POST /booked/  — get booked seats for a specific show
app.post("/booked/", async (request, response) => {
    const { location, theater_name, movie_name, start_time } = request.body
    try {
        const query = `
            SELECT * FROM bookings
            WHERE location LIKE ?
              AND theater_name LIKE ?
              AND movie_name LIKE ?
              AND start_time LIKE ?
        `
        const params = [location, theater_name, movie_name, start_time]
        const output = await db.all(query, params)
        response.json(output)
    } catch (e) {
        response.status(500).json({ error: e.message })
    }
})

// GET /my-bookings/  — get bookings for the logged-in user (protected)
app.get("/my-bookings/", authenticateToken, async (request, response) => {
    try {
        const query = `SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC`
        const bookings = await db.all(query, [request.user.id])
        response.json(bookings)
    } catch (e) {
        response.status(500).json({ error: e.message })
    }
})

// ─── THEATER ROUTES ───────────────────────────────────────────────────────────

// POST /addMovie/  — add a new movie/showtime to a theater
app.post("/addMovie/", async (request, response) => {
    try {
        const { location, theater_name, time, movie_name, movie_img } = request.body
        const timeJson = JSON.stringify(time)
        const query = `INSERT INTO Theater(location, theater_name, time, movie_name, movie_img) VALUES (?, ?, ?, ?, ?)`
        await db.run(query, [location, theater_name, timeJson, movie_name, movie_img])
        response.json({ message: "Movie added successfully" })
    } catch (e) {
        console.log(e.message)
        response.status(500).json({ error: e.message })
    }
})

// GET /theater/  — get all theaters
app.get("/theater/", async (request, response) => {
    try {
        const query = `SELECT * FROM Theater`
        const theaterdetails = await db.all(query)
        response.json(theaterdetails)
    } catch (e) {
        response.status(500).json({ error: e.message })
    }
})

// POST /theater/  — get theaters by location and movie name
app.post("/theater/", async (request, response) => {
    try {
        const { location, movieName } = request.body
        console.log(location, movieName)
        const query = `SELECT * FROM Theater WHERE location LIKE ? AND movie_name LIKE ?`
        const output = await db.all(query, [location, movieName])
        response.json(output)
    } catch (e) {
        console.log(e)
        response.status(500).json({ error: e.message })
    }
})

// DELETE /deleteAll  — delete all movies and theaters
app.delete("/deleteAll", async (request, response) => {
    try {
        await db.run(`DELETE FROM Theater`)
        await db.run(`DELETE FROM bookings`)
        response.json({ message: "All movies and theaters deleted successfully" })
    } catch (e) {
        console.log(e.message)
        response.status(500).json({ error: e.message })
    }
})

// DELETE /theater  — delete all theaters
app.delete("/theater", async (request, response) => {
    try {
        await db.run(`DELETE FROM Theater`)
        response.json({ message: "All theaters deleted successfully" })
    } catch (e) {
        console.log(e.message)
        response.status(500).json({ error: e.message })
    }
})


// POST /addMovies  — add multiple movies at once
app.post("/addMovies", async (request, response) => {
    try {
        const movies = request.body  // expects an array
        if (!Array.isArray(movies) || movies.length === 0) {
            return response.status(400).json({ error: "Send an array of movies" })
        }
        for (const movie of movies) {
            const { location, theater_name, time, movie_name, movie_img } = movie
            const timeJson = JSON.stringify(time)
            await db.run(
                `INSERT INTO Theater(location, theater_name, time, movie_name, movie_img) VALUES (?, ?, ?, ?, ?)`,
                [location, theater_name, timeJson, movie_name, movie_img]
            )
        }
        response.json({ message: `${movies.length} movies added successfully` })
    } catch (e) {
        console.log(e.message)
        response.status(500).json({ error: e.message })
    }
})

// POST /addBookings  — add multiple bookings/seats at once
app.post("/addBookings", async (request, response) => {
    try {
        const bookings = request.body  // expects an array
        if (!Array.isArray(bookings) || bookings.length === 0) {
            return response.status(400).json({ error: "Send an array of bookings" })
        }
        for (const booking of bookings) {
            const { user_id, start_time, seat_No, status, location, theater_name, movie_name } = booking
            await db.run(
                `INSERT INTO bookings(user_id, start_time, seat_No, status, location, theater_name, movie_name) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [user_id, start_time, seat_No, status || "BOOKED", location, theater_name, movie_name]
            )
        }
        response.json({ message: `${bookings.length} bookings added successfully` })
    } catch (e) {
        console.log(e.message)
        response.status(500).json({ error: e.message })
    }
})