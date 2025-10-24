
const express = require("express")
const path = require("path")
const cors = require("cors");

const { open } = require("sqlite")
const sqlite3 = require('sqlite3')

const app = express()
app.use(express.json())
app.use(cors({ origin: "http://localhost:3001" }));
const dbpath = path.join(__dirname, "database.db")

let db = null

const initializeDbAndServer = async () => {
    try {
        db = await open({
            filename: dbpath,
            driver: sqlite3.Database
        })
        await tablecreation()
        await theaterUpdateTableCreation()
        app.listen(3000, () => { console.log("Server Running at http;//localhost:3000/") })
    } catch (e) {
        console.log("Db error " + e.message)
        process.exit(1)
    }
}

initializeDbAndServer()

// for booking by the customers
const tablecreation = async () => {
    const sql = `CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER ,
  start_time TEXT ,
  seat_No TEXT ,
  status TEXT DEFAULT 'AVAILABLE',
  location TEXT,
  theater_name TEXT,
  movie_name TEXT,
  time TEXT
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);`;
    await db.exec(sql);
    //await db.exec(`DROP TABLE bookings`)

}

// for theater owner to upload new movie

const theaterUpdateTableCreation = async () => {
    const sql = `CREATE TABLE IF NOT EXISTS Theater (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location TEXT,
  theater_name TEXT,
  time TEXT,
  movie_name TEXT,
  movie_img TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);`;
    await db.exec(sql);
    //await db.exec(`DROP TABLE Theater`)

}
// posting or selecting seat
app.post("/seatbooking/", async (request, response) => {
    try {
        const { user_id, start_time, seat_No, status, location, theater_name, movie_name } = request.body
        const query = `INSERT INTO bookings(user_id, start_time,seat_No,status,location,theater_name,movie_name) VALUES (?,?,?,?,?,?,?)`
        await db.run(query, [user_id, start_time, seat_No, status, location, theater_name, movie_name])
        response.send("added seat")

    }
    catch (e) {
        response.send(e.message)
        
    }
})

// get all booked seats

app.get("/booked/", async (request, response) => {
    try {
        const query = `SELECT * FROM bookings`
        const alldetails = await db.all(query)
        response.send(alldetails)
    } catch (e) {
        response.send(e.message)
    }
})

// get based on the location,theater, (using it for seat)

app.post('/booked/', async (request, response) => {

    const { location, theater_name, movie_name, start_time } = request.body
    try {
        const query = `
      SELECT *
      FROM bookings
      WHERE location LIKE ?
        AND theater_name LIKE ?
        AND movie_name LIKE ?
        AND start_time LIKE ?
    `;
        const params = [`${location}`, `${theater_name}`, `${movie_name}`, `${start_time}`];
        const output = await db.all(query, params)
        response.send(output)
    } catch (e) {
        response.send(e.message)
    }
})

//post or adding theater
app.post('/addMovie/', async (request, response) => {
    try {
        const { location, theater_name, time, movie_name, movie_img } = request.body
        const timeJson = JSON.stringify(time); // store JSON array as string
        const query = `INSERT INTO Theater(location,theater_name,time,movie_name,movie_img) VALUES (?,?,?,?,?)`
        await db.run(query, [location, theater_name, timeJson, movie_name, movie_img])
        response.send("Added")

    } catch (e) {
        console.log(e.message)
    }
})

// get all Theater

app.get('/theater/', async (request, response) => {
    try {
        const query = `SELECT * FROM Theater`
        const theaterdetails = await db.all(query)
        response.send(theaterdetails)

    } catch (e) {
        response.send(e.message)
    }
})

// to get theater details based on location and movie name

app.post('/theater', async (request, response) => {
    try {

        const { location, movieName } = request.body
        console.log(location, movieName)

        const query = `SELECT * FROM Theater WHERE location LIKE '${location}' AND movie_name LIKE '${movieName}'`
        const output = await db.all(query)

        await response.send(output)
    } catch (e) {
        console.log(e)
    }
})


// app.post('/addMovie/', async (request, response) => {
//   try {
//     const movies = Array.isArray(request.body) ? request.body : [request.body];
//     const query = `INSERT INTO Theater(location, theater_name, time, movie_name, movie_img) VALUES (?, ?, ?, ?, ?)`;

//     for (const movie of movies) {
//       const { location, theater_name, time, movie_name, movie_img } = movie;
//       const timeJson = JSON.stringify(time); // store JSON array as string
//       await db.run(query, [location, theater_name, timeJson, movie_name, movie_img]);
//     }

//     response.send(`Added ${movies.length} entries successfully!`);
//   } catch (e) {
//     console.error(e.message);
//     response.status(500).send("Error inserting movies");
//   }
// });
