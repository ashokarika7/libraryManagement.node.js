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
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swaggerConfig');
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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
/**
 * @swagger
 * /librarian/users/:
 *   post:
 *     summary: Create a new library user
 *     tags: [Librarian]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *               role:
 *                 type: string
 *                 data: [Librarian, User]
 *                 example: User
 *               name:
 *                 type: string
 *                 example: John Doe
 *     responses:
 *       200:
 *         description: New user created successfully
 *       400:
 *         description: Invalid input or user already exists
 */

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
/**
 * @swagger
 * /librarian/borrow-requests/:
 *   get:
 *     summary: Retrieve all book borrow requests
 *     tags: [Librarian]
 *     
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   userId:
 *                     type: integer
 *                   bookId:
 *                     type: integer
 *                   startDate:
 *                     type: string
 *                     format: date
 *                   endDate:
 *                     type: string
 *                     format: date
 *                   status:
 *                     type: string
 *          
 *      responses:
 *       200:
 *         description: List of borrow requests         
 *       400:
 *         description: Error fetching borrow requests
 */

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
/**
 * @swagger
 * /librarian/borrow-requests/{requestid}/approve/:
 *   put:
 *     summary: Approve a borrow request
 *     description: Updates the status of a borrow request to "Approved" and logs the transaction in the BorrowHistory table.
 *     tags: [Librarian]
 *     parameters:
 *       - name: requestid
 *         in: path
 *         required: true
 *         description: ID of the borrow request to be approved
 *         schema:
 *           type: integer
 *           example: 8
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 description: New status for the borrow request
 *                 example: "Approved"
 *               bookId:
 *                 type: integer
 *                 description: ID of the book being borrowed
 *                 example: 2
 *               userId:
 *                 type: integer
 *                 description: ID of the user who made the request
 *                 example: 8
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: Start date of the borrow period
 *                 example: "2024-12-02"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 description: End date of the borrow period
 *                 example: "2024-12-08"
 *     responses:
 *       200:
 *         description: Borrow request approved and status updated successfully.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Status Successfully Updated"
 *       400:
 *         description: Invalid input or borrow request does not exist.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Invalid Request ID"
 *       500:
 *         description: Internal server error.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Internal Server Error"
 */

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
/**
 * @swagger
 * /librarian/borrow-requests/{requestid}/deny/:
 *   put:
 *     summary: Deny a borrow request
 *     description: Updates the status of a borrow request to "Denied".
 *     tags: [Librarian]
 *     parameters:
 *       - name: requestid
 *         in: path
 *         required: true
 *         description: ID of the borrow request to be denied
 *         schema:
 *           type: integer
 *           example: 2
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 description: New status for the borrow request
 *                 example: "Denied"
 *     responses:
 *       200:
 *         description: Borrow request denied and status updated successfully.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Status Successfully Updated"
 *       400:
 *         description: Invalid input or borrow request does not exist.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Invalid Request ID"
 *       500:
 *         description: Internal server error.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Internal Server Error"
 */

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
/**
 * @swagger
 * /librarian/{userid}/history/:
 *   get:
 *     summary: View a user's borrow history
 *     description: Retrieves the borrow history of a specific user by their user ID.
 *     tags: [Librarian]
 *     parameters:
 *       - name: userid
 *         in: path
 *         required: true
 *         description: The unique user ID whose borrow history is being retrieved.
 *         schema:
 *           type: integer
 *           example: 1
 * 
 *     responses:
 *       200:
 *         description: Successfully retrieved borrow history.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: integer
 *                   description: The ID of the user.
 *                 BrowserHistory:
 *                   type: array
 *                   description: List of borrow history records.
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         description: The unique ID of the borrow record.
 *                       bookId:
 *                         type: integer
 *                         description: The ID of the book that was borrowed.
 *                       borrowedOn:
 *                         type: string
 *                         format: date
 *                         description: The date when the book was borrowed.
 *                       returnedOn:
 *                         type: string
 *                         format: date
 *                         description: The date when the book was returned.
 *             example:
 *               userId: 1
 *               BrowserHistory:
 *                 - id: 10
 *                   bookId: 5
 *                   borrowedOn: "2024-12-02"
 *                   returnedOn: "2024-12-08"
 *                 - id: 11
 *                   bookId: 7
 *                   borrowedOn: "2024-11-25"
 *                   returnedOn: "2024-12-01"
 *       400:
 *         description: Invalid User ID.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Invalid UserId"
 *       500:
 *         description: Internal server error.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Internal Server Error"
 */

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
/**
 * @swagger
 * /users/login/:
 *   post:
 *     summary: User Login
 *     description: Authenticates a user and returns a JWT token if the credentials are valid.
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The email of the user attempting to log in.
 *                 example: "praveen@gmail.com"
 *               password:
 *                 type: string
 *                 description: The password of the user.
 *                 example: "praveen"
 *     responses:
 *       200:
 *         description: Successfully authenticated. Returns a JWT token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jwtToken:
 *                   type: string
 *                   description: The JWT token generated upon successful login.
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       400:
 *         description: Invalid credentials or email does not exist.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Invalid User"
 *       401:
 *         description: Incorrect password provided.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Invalid Password"
 *       500:
 *         description: Internal server error occurred.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Internal Server Error"
 */
 
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
/**
 * @swagger
 * /users/books/:
 *   get:
 *     summary: Get List of Books
 *     description: Retrieves a list of all available books from the database. Requires authentication.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved the list of books.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: The unique ID of the book.
 *                     example: 1
 *                   title:
 *                     type: string
 *                     description: The title of the book.
 *                     example: "The Great Gatsby"
 *                   author:
 *                     type: string
 *                     description: The author of the book.
 *                     example: "F. Scott Fitzgerald"
 *                   published_year:
 *                     type: integer
 *                     description: The year the book was published.
 *                     example: 1925
 *       401:
 *         description: Unauthorized - Invalid token or token missing.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Unauthorized"
 *       500:
 *         description: Internal server error occurred.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Internal Server Error"
 */

app.get('/users/books/', authenticateToken, async(request,response) => {
    
    const getBooksQuery= `
    SELECT * FROM Books;
    `
    const booksList= await db.all(getBooksQuery);
    response.send(booksList);
})

//SEND BOOKREQUEST API
/**
 * @swagger
 * /users/borrow-requests/:
 *   post:
 *     summary: Send Borrow Request
 *     description: Allows a user to send a borrow request for a book with defined borrowing dates. Requires authentication.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: ID of the user sending the borrow request.
 *                 example: 8
 *               bookId:
 *                 type: integer
 *                 description: ID of the book being borrowed.
 *                 example: 2
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: Borrow request start date.
 *                 example: "2024-12-02"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 description: Borrow request end date.
 *                 example: "2024-12-08"
 *     responses:
 *       200:
 *         description: Borrow request created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 borrowRequestId:
 *                   type: integer
 *                   description: ID of the created borrow request.
 *                   example: 1
 *       400:
 *         description: Invalid user ID, book ID, or date range. Or if the book is already borrowed during the requested period.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Invalid UserId"
 *       401:
 *         description: Unauthorized access - Invalid or missing token.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Unauthorized"
 *       500:
 *         description: Internal server error.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Internal Server Error"
 */

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
/**
 * @swagger
 * /users/{bookid}/books/history/:
 *   get:
 *     summary: Get Borrow History of a Specific Book
 *     description: Retrieves the borrow history of a specific book identified by its book ID. Requires authentication.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: bookid
 *         in: path
 *         required: true
 *         description: The ID of the book for which the history is being fetched.
 *         schema:
 *           type: integer
 *           example: 2
 *     responses:
 *       200:
 *         description: Successfully retrieved the borrow history of the book.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 bookid:
 *                   type: integer
 *                   description: The ID of the book.
 *                   example: 2
 *                 BrowserHistory:
 *                   type: array
 *                   description: List of borrowing history related to the specific book.
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         description: The unique ID of the borrow record.
 *                         example: 1
 *                       borrowedOn:
 *                         type: string
 *                         format: date
 *                         description: The date the book was borrowed.
 *                         example: "2023-11-25"
 *                       returnedOn:
 *                         type: string
 *                         format: date
 *                         description: The date the book was returned.
 *                         example: "2023-12-01"
 *       400:
 *         description: Invalid book ID or user token.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Invalid UserId"
 *       401:
 *         description: Unauthorized - Invalid or missing token.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Unauthorized"
 *       500:
 *         description: Internal server error.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Internal Server Error"
 */

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
/**
 * @swagger
 * /users/history/csv/:
 *   get:
 *     summary: Download User's Borrow History as CSV
 *     description: Allows an authenticated user to download their borrow history as a CSV file. Requires token-based authentication.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully generated and downloaded borrow history in CSV format.
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               example: "id,book_id,borrowed_on,returned_on\n1,101,2023-11-01,2023-11-15\n2,102,2023-11-10,2023-11-20"
 *       400:
 *         description: Invalid user token or no history found.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Invalid User"  
 *       401:
 *         description: Unauthorized - Invalid or missing token.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Unauthorized"
 *       500:
 *         description: Server error while generating the CSV response.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Internal Server Error"
 */

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
