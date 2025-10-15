
const express = require("express")
const path = require("path")

const { open } = require("sqlite")
const sqlite3 = require('sqlite3')

const app = express()
app.use(express.json())
const dbpath = path.join(__dirname, "database.db")

let db = null

const initializeDbAndServer = async () => {
    try {
        db = await open({
            filename: dbpath,
            driver: sqlite3.Database
        })
        await tablecreation()
        app.listen(3000, () => { console.log("Server Running at http;//localhost:3000/") })
    } catch (e) {
        console.log("Db error " + e.message)
        process.exit(1)
    }
}

initializeDbAndServer()

const tablecreation = async () => {
    const sql = `CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER ,
  start_time TEXT ,
  seat_No TEXT ,
  status TEXT DEFAULT 'AVAILABLE',
  location TEXT,
  theater_name TEXT
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);`;
    await db.exec(sql);
    // await db.exec(`DROP TABLE bookings`)

}

app.post("/seatbooking/", async (request, response) => {
    try {
        const { user_id, start_time, seat_No, status,location,theater_name } = request.body
        const query = `INSERT INTO bookings(user_id, start_time,seat_No,status,location,theater_name) VALUES (?,?,?,?,?,?)`
        await db.run(query, [user_id, start_time, seat_No, status,location,theater_name])
        response.send("added")
    }
    catch (e) {
        response.send(e.message)
    }
})

app.get("/booked/", async(request,response)=>{
    try{
        const query = `SELECT * FROM bookings`
        const alldetails = await db.all(query)
        response.send(alldetails)
    }catch(e){
        response.send(e.message)
    }
})