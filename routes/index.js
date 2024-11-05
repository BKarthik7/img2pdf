var express = require('express');
var router = express.Router();
var multer = require('multer');
var path = require('path');
var fs = require('fs');
var PDFDocument = require('pdfkit');
const unlink = require('fs').unlinkSync;

// POST route to generate PDF from images
router.post('/pdf', function(req, res, next) {
    let body = req.body; // The image file names sent in the body

    // Ensure the PDF directory exists
    const pdfDir = path.join(__dirname, '..', 'public', 'pdf');
    if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir, { recursive: true });
    }

    // Create a new PDF document
    let doc = new PDFDocument({ size: 'A4', autoFirstPage: false });
    let pdfName = 'pdf-' + Date.now() + '.pdf';

    // Pipe the document to a file in the public/pdf folder
    doc.pipe(fs.createWriteStream(path.join(pdfDir, pdfName)));

    // Add pages to the PDF with images from the body
    for (let name of body) {
        doc.addPage();
        doc.image(path.join(__dirname, '..', 'public', 'images', name), 20, 20, {
            width: 555.28,
            align: 'center',
            valign: 'center'
        });
    }

    // End the PDF creation
    doc.end();

    // Send the file path of the generated PDF back to the browser
    res.send(`/pdf/${pdfName}`);
});

// Multer storage configuration
let storage = multer.diskStorage({
    // Store the images in the public/images folder
    destination: function(req, file, cb) {
        cb(null, 'public/images');
    },
    // Rename the images based on fieldname and timestamp
    filename: function(req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + '.' + file.mimetype.split('/')[1]);
    }
});

// File filter for allowed image formats
let fileFilter = (req, file, callback) => {
    let ext = path.extname(file.originalname);
    // Allow only .png and .jpg files
    if (ext !== '.png' && ext !== '.jpg') {
        return callback(new Error('Only png and jpg files are accepted'));
    } else {
        return callback(null, true);
    }
};

// Initialize Multer with storage and file filter
var upload = multer({ storage, fileFilter: fileFilter });

// POST route to upload images
router.post('/upload', upload.array('images'), function(req, res) {
    let files = req.files;
    let imgNames = [];

    // Extract filenames from uploaded files
    for (let file of files) {
        imgNames.push(file.filename);
    }

    // Store the image filenames in the session
    req.session.imagefiles = imgNames;

    // Redirect to the root URL route
    res.redirect('/');
});

// DELETE route to clear images from session and filesystem
router.get('/new', function(req, res, next) {
    let filenames = req.session.imagefiles;

    // Function to delete files from the filesystem
    let deleteFiles = async (paths) => {
        let deleting = paths.map(file => unlink(path.join(__dirname, '..', 'public', 'images', file)));
        await Promise.all(deleting);
    };

    // Delete the images from the filesystem
    deleteFiles(filenames)
        .then(() => {
            // Clear the session data
            req.session.imagefiles = undefined;

            // Redirect to the root URL
            res.redirect('/');
        })
        .catch(err => {
            console.error('Error deleting files:', err);
            res.status(500).send('Error deleting files');
        });
});

// GET route for the root page
router.get('/', function(req, res, next) {
    // If no images are in the session, serve the default HTML page
    if (req.session.imagefiles === undefined) {
        res.sendFile(path.join(__dirname, '..', 'public', 'html', 'index.html'));
    } else {
        // If images are stored in the session, render them in the index.jade view
        res.render('index', { images: req.session.imagefiles });
    }
});

module.exports = router;
