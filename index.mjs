import express from 'express';
import mysql from 'mysql2/promise';

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

//for Express to get values using the POST method
app.use(express.urlencoded({ extended: true }));

//setting up database connection pool, replace values in red
const pool = mysql.createPool({
    host: "xefi550t7t6tjn36.cbetxkdyhwsb.us-east-1.rds.amazonaws.com",
    user: "te520qdg3xdxil97",
    password: "a0966id4k3ay6xph",
    database: "llxwemzu8cciv8ai",
    connectionLimit: 10,
    waitForConnections: true
});

//routes
app.get('/', (req, res) => {
    res.render('home.ejs');
});

//This function looks up a single quote by ID
async function getQuoteById(quoteId) {

    console.log(quoteId);
    let singleQuoteQuery = `SELECT * FROM quotes WHERE quoteId = ?`;
    let params = [quoteId];
    const [rows] = await pool.query(singleQuoteQuery, params);
    console.log(rows);

    if (rows.length < 1) {
        return null;
    } else {
        return rows[0];
    }


}

async function getAuthorById(authorId) {
    let singleAuthorQuery = `SELECT * FROM authors WHERE authorId = ?`;
    let params = [authorId];
    const [rows] = await pool.query(singleAuthorQuery, params);

    if (rows.length < 1) {
        return null;
    } else {
        let author = rows[0];

        // format dates
        const formatDate = (dateObj) => {
            if (!dateObj) return '';
            let d = new Date(dateObj);
            let month = '' + (d.getMonth() + 1);
            let day = '' + d.getDate();
            let year = d.getFullYear();

            if (month.length < 2) month = '0' + month;
            if (day.length < 2) day = '0' + day;

            return [year, month, day].join('-');
        };

        return {
            authorId: author.authorId,
            firstName: author.firstName,
            lastName: author.lastName,
            birthDate: formatDate(author.dob),
            deathDate: formatDate(author.dod),
            gender: author.gender,
            profession: author.profession,
            country: author.country
        };
    }
}

//This function gets all the data we need for dropdown lists
async function getQuoteFormData() {
    let getAuthorsQuery = 'SELECT * FROM authors;';
    const [authorRows] = await pool.query(getAuthorsQuery);

    //the categories query will have to happen here as well!
    let getCategoriesQuery = 'SELECT DISTINCT category FROM quotes;';
    const [cateRows] = await pool.query(getCategoriesQuery);

    let formErrors = {}; //can be populated with errors for each field

    return { authors: authorRows, categories: cateRows };
}

// renders an empty new quote form
app.get('/newQuote', async (req, res) => {

    //this runs any queries to populate drop-downlists
    let formData = await getQuoteFormData();

    res.render('newQuote.ejs', { formData, formErrors: {} });
});

// submits the users input to be entered into the db
app.post('/insertQuote', async (req, res) => {
    let quote = req.body.quote;
    let authorId = req.body.authorId;
    let category = req.body.category;
    let likes = req.body.likes;


    let hasErrors = false;
    let errors = {};

    if (quote === '') {
        hasErrors = true;
        errors.quote = "Quote cannot be empty";
    } // you can add other checks after this 

    if (likes < 0) {
        hasErrors = true;
        errors.likes = "Likes cannot be negative";
    }

    if (hasErrors) {

        let formData = await getQuoteFormData();
        //attach errors to be returned with the form
        formData.formErrors = errors;
        res.render('newQuote.ejs', { formData, formErrors: errors });

    } else {

        let insertQuery =
            `INSERT INTO quotes (quote, authorId, category, likes) 
        VALUES (?, ?, ?, ?);`

        let params = [quote, authorId, category, likes];

        const [rows] = await pool.query(insertQuery, params);

        //res.render('newQuote.ejs');
        res.redirect('/newQuote');

    }
});

// renders the edit quote form
app.get('/editQuote', async (req, res) => {

    let quoteId = req.query.quoteId;
    let quoteObject = await getQuoteById(quoteId);

    if (quoteObject == null) {
        res.redirect('/quoteList');
    } else {
        let formData = await getQuoteFormData();
        let formObject = quoteObject; // the first record should be the quote we're editing

        //breaking this down:
        //formData is the data for the dropdown lists
        //form object is the "starter" information for the quote we're editing so
        //      it can get plugged into the form
        //formErrors is empty  
        res.render('editQuote.ejs', { formData, formObject, formErrors: {} });
    }
});


app.get('/quoteList', async (req, res) => {
    let quotesQuery = `SELECT * FROM quotes`;
    const [rows] = await pool.query(quotesQuery);

    res.render('quoteList.ejs', { quotes: rows });

});


app.post('/updateQuote', async (req, res) => {
    let quoteId = req.body.quoteId;
    let quote = req.body.quote;
    let authorId = req.body.authorId;
    let category = req.body.category;
    let likes = req.body.likes;

    let errors = {};
    let hasErrors = false;

    if (quote.trim() === "") {
        errors.quote = "Quote cannot be empty";
        hasErrors = true;
    }

    if (likes < 0) {
        errors.likes = "Likes cannot be negative";
        hasErrors = true;
    }

    if (hasErrors) {
        // Re-fetch dropdown data and keep user's submitted values
        let formData = await getQuoteFormData();
        let formObject = { quoteId, quote, authorId, category, likes };

        res.render('editQuote.ejs', { formObject, formData, formErrors: errors });
    } else {
        let updateQuery = `
            UPDATE quotes SET
                quote = ?,
                authorId = ?,
                category = ?,
                likes = ?
            WHERE quoteId = ?`;

        let params = [quote, authorId, category, likes, quoteId];
        await pool.query(updateQuery, params);

        res.redirect('/quoteList');
    }
});

app.get('/newAuthor', (req, res) => {
    res.render('newAuthor.ejs', { formErrors: {}, formObject: {} });
});

app.post('/insertAuthor', async (req, res) => {
    let firstName = req.body.firstName;
    let lastName = req.body.lastName;
    let birthDate = req.body.birthDate;
    let deathDate = req.body.deathDate;
    let genderInput = req.body.gender;
    let gender = genderInput.toUpperCase();
    let profession = req.body.profession;
    let country = req.body.country;

    let errors = {};
    let hasErrors = false;

    if (!firstName || firstName.trim() === "") {
        errors.firstName = "First name cannot be empty";
        hasErrors = true;
    }

    if (!lastName || lastName.trim() === "") {
        errors.lastName = "Last name cannot be empty";
        hasErrors = true;
    }

    if (!birthDate) {
        errors.birthDate = "Birth date cannot be empty";
        hasErrors = true;
    }

    if (!deathDate) {
        errors.deathDate = "Death date cannot be empty";
        hasErrors = true;
    }

    if (new Date(birthDate) > new Date(deathDate)) {
        errors.deathDate = "no paradoxes allowed";
        hasErrors = true;
    }

    if (!gender) {
        errors.gender = "Gender cannot be empty";
        hasErrors = true;
    }

    if (!profession) {
        errors.profession = "Profession cannot be empty";
        hasErrors = true;
    }

    if (!country) {
        errors.country = "Country cannot be empty";
        hasErrors = true;
    }

    if (hasErrors) {
        res.render('newAuthor.ejs', {
            formErrors: errors,
            formObject: { firstName, lastName, birthDate, deathDate, gender, profession, country }
        });
    } else {
        let insertQuery = `
            INSERT INTO authors (firstName, lastName, dob, dod, gender, profession, country)
            VALUES (?, ?, ?, ?, ?, ?, ?);`;

        let params = [firstName, lastName, birthDate, deathDate, gender, profession, country];
        await pool.query(insertQuery, params);

        res.redirect('/');
    }
});

app.get('/authorList', async (req, res) => {
    let authorsQuery = `SELECT * FROM authors`;
    const [rows] = await pool.query(authorsQuery);

    res.render('authorList.ejs', { authors: rows });
});

app.get('/editAuthor', async (req, res) => {
    let authorId = req.query.authorId;
    let authorObject = await getAuthorById(authorId);

    if (authorObject == null) {
        res.redirect('/authorList');
    } else {
        let formObject = authorObject; 
        res.render('editAuthor.ejs', { formObject, formErrors: {} });
    }
});

app.post('/updateAuthor', async (req, res) => {
    let authorId = req.body.authorId;
    let firstName = req.body.firstName;
    let lastName = req.body.lastName;
    let birthDate = req.body.birthDate;
    let deathDate = req.body.deathDate;
    let genderInput = req.body.gender;
    let gender = genderInput.toUpperCase();
    let profession = req.body.profession;
    let country = req.body.country;

    let errors = {};
    let hasErrors = false;

    if (!firstName || firstName.trim() === "") {
        errors.firstName = "First name cannot be empty";
        hasErrors = true;
    }

    if (!lastName || lastName.trim() === "") {
        errors.lastName = "Last name cannot be empty";
        hasErrors = true;
    }

    if (!birthDate) {
        errors.birthDate = "Birth date cannot be empty";
        hasErrors = true;
    }

    if (!deathDate) {
        errors.deathDate = "Death date cannot be empty";
        hasErrors = true;
    }

    if (new Date(birthDate) > new Date(deathDate)) {
        errors.deathDate = "no paradoxes allowed";
        hasErrors = true;
    }

    if (!gender) {
        errors.gender = "Gender cannot be empty";
        hasErrors = true;
    }

    if (!profession) {
        errors.profession = "Profession cannot be empty";
        hasErrors = true;
    }

    if (!country) {
        errors.country = "Country cannot be empty";
        hasErrors = true;
    }

    if (hasErrors) {
        let formObject = { authorId, firstName, lastName, birthDate, deathDate, gender, profession, country };
        res.render('editAuthor.ejs', { formObject, formErrors: errors });
    } else {
        let updateQuery = `
            UPDATE authors SET
                firstName = ?,
                lastName = ?,
                dob = ?,
                dod = ?,
                gender = ?,
                profession = ?,
                country = ?
            WHERE authorId = ?`;

        let params = [firstName, lastName, birthDate, deathDate, gender, profession, country, authorId];
        await pool.query(updateQuery, params);

        res.redirect('/authorList');
    }
});


// app.get("/dbTest", async (req, res) => {
//     try {
//         const [rows] = await pool.query("SELECT CURDATE()");
//         res.send(rows);
//     } catch (err) {
//         console.error("Database error:", err);
//         res.status(500).send("Database error!");
//     }
// });//dbTest

app.listen(3000, () => {
    console.log("Express server running")
})