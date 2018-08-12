require('dotenv').config();

var express = require('express'),
	bodyParser = require('body-parser'),
    methodOverride = require('method-override'),
    cors = require('cors'),
	app = express();

// ENVIRONMENT CONFIG
var env = process.env.NODE_ENV = process.env.NODE_ENV || 'development';
var port = process.env.PORT || 3000;
var router = express.Router();

// EXPRESS CONFIG
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
})); 
app.use(methodOverride());
app.use(express.static(__dirname + '/public'));

// stripe config
var stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// mailgun config
var domain = 'artfuldodgers.co.nz';
var mailcomposer = require('mailcomposer');
var mailgun = require('mailgun-js')({ 
	apiKey: process.env.MAILGUN_API_KEY, 
	domain: domain 
});
console.log('domain ', domain)

// ROUTES
router.post('/charge', function(req, res){
	
	var newCharge = {
		amount: 23500,
		currency: "usd",
		source: req.body.token_from_stripe, // obtained with Stripe.js
		description: req.body.engravingText,
		receipt_email: req.body.email,
		shipping: {
			name: req.body.name,
			address: {
				line1: req.body.address.street,
				city: req.body.address.city,
				state: req.body.address.state,
				postal_code: req.body.address.zip,
				country: 'US'
			}
		}
	};

	// trigger charge
	stripe.charges.create(newCharge, function(err, charge) {
		// send response
		if (err){
			console.error(err);
			res.json({ error: err, charge: false });
		} else {
			// format for email
			var emailTemplate = `Hello ${newCharge.shipping.name}, \n
			Congratulations on ordering a AD ring! \n
			Engraving: ${newCharge.description} \n
			Shipping Info: ${newCharge.shipping.address.line1}, ${newCharge.shipping.address.city}, ${newCharge.shipping.address.state} ${newCharge.shipping.address.postal_code} \n
			Amount: ${newCharge.amount} \n
			Your full order details are available at something.artfuldodgers.co.nz/${charge.id} \n
			For questions contact services@artfuldodger.co.nz \n 
			Thank you!`;
			// compose email
			var emailData = {
				from: 'Your Name <services@artfuldodgers.co.nz>',
				to: req.body.email,
				subject: 'Artful Dodgers Receipt - ' + charge.id,
				text: emailTemplate
			};

			// send email to customer
			mailgun.messages().send(emailData);

			emailData['to'] = 'woaitsleo@gmail.com';
			emailData['subject'] = `New Order: AD ring - ${charge.id}`;

			// send email to supplier
			mailgun.messages().send(emailData, function(err, success){
				if (err){
					console.log("err", err);
				} else {
					console.log("success", success);
				}
			});
			console.log("mail sent 2");

			// send response with charge data
			res.json({ error: false, charge: charge });
		}
	});
});

// get data for charge by id
router.get('/charge/:id', function(req, res){
	stripe.charges.retrieve(req.params.id, function(err, charge) {
		if (err){
			res.json({ error: err, charge: false });
		} else {
			res.json({ error: false, charge: charge });
		}
	});
});

app.use('/', router);

// Start server
app.listen(port, function(){
  console.log('Server listening on port ' + port)
});