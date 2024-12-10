# Library Management System

## Overview

This Library Management System provides an API for managing users, books, borrow requests, and borrow histories for a library. It uses `Express.js` for the backend, `SQLite` for the database, and `JWT` for user authentication. The system is divided into two user roles: **Librarian** and **User**.

## Features

### User Role
1. **Login**: Allows users to login using email and password.
2. **View Books**: Get a list of all available books.
3. **Submit Borrow Request**: Users can request to borrow books for a specified period.
4. **View Borrow History**: Users can view their borrowing history.
5. **Download Borrow History as CSV**: Users can download their borrow history as a CSV file.

### Librarian Role
1. **Create User**: Allows the creation of new library users with roles (User or Librarian).
2. **View Borrow Requests**: View all borrow requests made by users.
3. **Approve/Deny Borrow Requests**: Approve or deny borrow requests.
4. **View User Borrow History**: View the borrow history of a specific user.

## Setup

### 1. Install Dependencies

Install the required dependencies by running:

```bash
npm install
