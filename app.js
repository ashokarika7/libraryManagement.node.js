const express= require('express')
const app= express()
const path= require('path')
const sqlite= require('sqlite')
const sqlite3= require('sqlite3').verbose()
app.use(express.json())
const {open}= require('sqlite')

const dbPath= path.join(__dirname, 'libraryDatabase.db')
let db= null 

const initializeServerAndDB= async() => {
    try{
        db= await open({
            filename: dbPath,
            driver: sqlite3.Database,
        })
        app.listen(3000, () => {
            console.log('Server started at http://localhost:3000')
        })
    } catch(e){
        console.log(`DB Error: ${e.message}`)
        process.exit(1)
    }
}

initializeServerAndDB() 

// GET BOOKS 
app.post('/books/', (request,response) => {
    const {name,age}= request.body
    console.log(name)
    response.send({'name': name})
})