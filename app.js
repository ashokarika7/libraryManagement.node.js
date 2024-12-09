const express= require('express')
const app= express()
const path= require('path')
const sqlite= require('sqlite')
const bcrypt= require('bcrypt')
const { parse } = require('json2csv');
const sqlite3= require('sqlite3').verbose()
const jwt = require('jsonwebtoken'); 
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

//AUTHENTICATION




// AUTHENTICATION
const authenticateToken= (request,response,next) => {
    let jwtToken;
    const authHeader= request.headers["authorization"];
    if  (authHeader !== undefined){
        jwtToken= authHeader.split(" ")[1];
    }
    if (jwtToken === undefined){
        response.status(401)
        response.send("Invalid JWT Token");
    }else{
        jwt.verify(jwtToken, "code", async(error, payload) => {
            if (error){
                response.status(401);
                response.send('Invalid JWT Token')
            }else{
              
                request.email= payload.email;
                next();
            }
        })
    }
}

//LIBRARIAN APIs..............

// CREATE A NEW USER API 
app.post('/librarian/users/', async(request,response) => {
    const {email,password,role,name}= request.body
    const hashedPassword= await bcrypt.hash(password,10);
    const selectUserQuery= `SELECT * FROM Users WHERE email = '${email}';`;
    const dbUser= await db.get(selectUserQuery);
    if (dbUser === undefined){
        const roles = ['Librarian', 'User'];
    
    if (!roles.includes(role) ){
        response.status(400)
        return response.send('Invalid role')
    }
    const addUser= `
        INSERT INTO Users (
        email,password,role,name
        )
        VALUES
        ('${email}', '${hashedPassword}', '${role}','${name}');
    `;
    const dbResponse= await db.run(addUser)
    const userId= dbResponse.lastID;
    response.send(`Created new user with ${userId}`);

    }else{
        response.status(400);
        response.send('User already exists');
    }
    
})

//GET BORROW REQUESTS API 
app.get('/librarian/borrow-requests/', async(request,response) => {
    const borrowRequestsQuery= `
        SELECT * FROM BorrowRequests;
    `;
    const borrowRequests= await db.all(borrowRequestsQuery)
    const updatedList= (data) =>({
        id: data.id,
        userId: data.user_id,
        bookId: data.book_id,
      
       
        startDate: data.start_date,
        endDate: data.end_date,
        status: data.status,

    })

    const res= borrowRequests.map(eachItem => updatedList(eachItem))
    
    response.send(res);
})

//APPROVE BORROW REQUEST API 
app.put("/librarian/borrow-requests/:requestid/approve/", async(request,response)=> {
    const {requestid}= request.params
    const {status,bookId,userId,startDate,endDate}= request.body

    const updateStausQuery= `
        UPDATE BorrowRequests SET 
        status= "${status}" 
        WHERE id = ${requestid};
    `;

    const borrowHistoryQuery= `
    INSERT INTO BorrowHistory
    (book_id, user_id, borrowed_on, returned_on)
    VALUES
        (${bookId}, ${userId}, '${startDate}', '${endDate}');
`;

    await db.run(borrowHistoryQuery);
    await db.run(updateStausQuery)
    response.send("Status Successfully Updated")

})

//DENY A BORROW REQUEST
app.put("/librarian/borrow-requests/:requestid/deny/", async(request,response)=> {
    const {requestid}= request.params
    const {status}= request.body

    const updateStausQuery= `
        UPDATE BorrowRequests SET 
        status= "${status}" 
        WHERE id = ${requestid};
    `;

    await db.run(updateStausQuery)
    response.send("Status Successfully Updated")

})

// USERS BORROW HISTORY
app.get('/librarian/:userid/history/', async(request,response) => {
    
    const {userid}= request.params 
    

    const userCheck= `SELECT * FROM Users WHERE id=${userid}`
    const user= await db.get(userCheck);
    if (user === undefined){
        response.status(400)
        return response.send('Invalid UserId')
    }

    const historyRequest= `
        SELECT 
        * FROM BorrowHistory WHERE user_id=${userid}
    `;
    

    const history= await db.all(historyRequest);
    
    const updatedList= (data) =>({
        id: data.id,
        bookId: data.book_id,
        borrowedOn: data.borrowed_on,
        returnedOn: data.returned_on,

    })

    const rows= history.map(eachItem => updatedList(eachItem))
    const res= {userId: userid, BrowserHistory:rows}
    response.send(history)  

})



//USER API................

//USER LOGIN API 
app.post ('/users/login', async(request,response) => {
    const {email,password}= request.body;
    const selectUserQuery= `SELECT * FROM Users WHERE email='${email}';`;
    const dbUser= await db.get(selectUserQuery);
    if (dbUser === undefined){
        response.status(400)
        response.send('Invalid User');
    }else{
        const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
        if (isPasswordMatched === true){
            const payload= {email: email}
            const jwtToken= jwt.sign(payload, 'code');
            response.send({jwtToken});
        }else{
            response.status(400);
            response.send('Invalid Password');
        }
    }
})




// GET BOOKS USER API
app.get('/users/books/', authenticateToken, async(request,response) => {
    
    const getBooksQuery= `
    SELECT * FROM Books;
    `
    const booksList= await db.all(getBooksQuery);
    response.send(booksList);
})

//SEND BOOKREQUEST API
app.post('/users/borrow-requests/',authenticateToken , async(request,response) => {
    const {userId,bookId,startDate,endDate}= request.body 

    
    
    if (request.email === undefined){
        response.status(400)
        return response.send('Invalid User')
    }

    const userCheck= `SELECT * FROM Users WHERE id=${userId}`
    const user= await db.get(userCheck);
    if (user === undefined){
        response.status(400)
        return response.send('Invalid UserId')
    }

    const bookCheck= `SELECT * FROM Books WHERE book_id=${bookId}`
    const book= await db.get(bookCheck);
    if (book === undefined){
        response.status(400)
        return response.send('Invalid BookId')
    }

    const checkBookIsBorrowed= `
        SELECT * FROM BorrowRequests  
        WHERE book_id=${bookId} AND ((start_date BETWEEN ${startDate} AND ${endDate}) OR (end_date BETWEEN ${startDate} AND ${endDate}));
    `;

    const checkBookAvailability= await db.get(checkBookIsBorrowed);
    if (checkBookAvailability){
        response.status(400);
        return response.send("Book borrowed during the reqest period")
    }


    const borrowRequestQuery= `
        INSERT INTO BorrowRequests
        (user_id, book_id, start_date, end_date)
        VALUES
            (${bookId}, ${userId}, '${startDate}', '${endDate}');
    `

    
    const dbBorrowResponse= await db.run(borrowRequestQuery)
    const borrowRequestId= dbBorrowResponse.lastID
    response.send({borrowRequestId:borrowRequestId})

} )  


// USERS BORROW BOOK HISTORY
app.get('/users/:bookid/books/history/', authenticateToken, async(request,response) => {
    
    const {bookid}= request.params 
    if (request.email === undefined){
        response.status(400)
        return response.send('Invalid User')
    } 

    

    const bookCheck= `SELECT * FROM Books WHERE book_id=${bookid}`
    const book= await db.get(bookCheck);
    if (book === undefined){
        response.status(400)
        return response.send('Invalid UserId')
    }

    const historyRequest= `
        SELECT 
        * FROM BorrowHistory WHERE book_id=${bookid}
    `;

    
    

    const history= await db.all(historyRequest);
    
    const updatedList= (data) =>({
        id: data.id,
        bookId: data.book_id,
        borrowedOn: data.borrowed_on,
        returnedOn: data.returned_on,

    })

    const rows= history.map(eachItem => updatedList(eachItem))
    const res= {bookid: bookid, BrowserHistory:rows}
    response.send(res)  

})

//DOWNLOAD CSV API 
app.get('/users/history/csv/', authenticateToken, async(request,response) => {
    if (request.email === undefined){
        response.status(400)
        return response.send('Invalid User')
    }

    const getUserQuery= `SELECT * FROM Users WHERE email='${request.email}'`;
    const user = await db.get(getUserQuery);
    if (!user){
        response.status(400)
        return response.send('Invalid User')
    }

    const userId= user.id;
    const historyQuery= `
        SELECT * FROM BorrowHistory WHERE user_id=${userId};
    `;

    const responseHistory= await db.all(historyQuery);
    if (!responseHistory || responseHistory.length === 0){
        response.status(400)
        return response.send("No History Found")
    }

    try{
        const csv= parse(responseHistory);
    response.header('Content-Type', 'text/csv');
    response.header('Content-Disposition', 'attachment; filename="borrow_history.csv"');
    response.send(csv);
    }
    catch(e){
        console.log(`Error Message: ${e.message}`)
    }
    


})
