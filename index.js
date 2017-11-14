var settings = require('./settings');
var express = require('express');
var bodyParser = require('body-parser')
var requstPromise = require('request-promise');
var nodemailer = require('nodemailer');

//This is using a dummy gmail account. 
//You can use your own but carefull, this is not secure
var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'se.sg.demo@gmail.com',
    pass: 'se.sg.dem0' //never store your password in clear
  }
});

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
var received_leads = [];
var received_all = [];

app.set('port', (process.env.PORT || 3000));

//What happens when we have a GET request (e.g. open in a browser)
app.get('/webhook', function(request, response) {
  var mode = request.query['hub.mode']

  //Authentify our server with our FB App by passing the challenge
  if (mode === 'subscribe') {
    var challenge = request.query['hub.challenge']
    var vt = request.query['hub.verify_token']
    if (vt === settings.verify_token) {
      response.send(challenge);
    }
  } 
  else //Display all the previously received POST requests 
  {
    response_str = 'All <pre>' + JSON.stringify(received_all, null, 2) + '</pre>'
    response_str += 'Leads <pre>' + JSON.stringify(received_leads, null, 2) + '</pre>';
    response.send(response_str);
  }
});

//What happens when we have POST request (e.g. trigger by our FB App)
app.post('/webhook', function(request, response) {
  
  //This simply keeps track of all post requests coming in (for debugging)
  received_all.unshift(request.body);

  //This part does the "smart stuff". 
  //It parses the incoming request, extract the different lead fields
  //and uses them to send a mail to the user

  
  var leadid = request.body.entry[0].changes[0].value.leadgen_id;
  var options = {
    uri: 'https://graph.facebook.com/v2.8/' + leadid + '/',
    qs: { access_token: settings.access_token },
    json: true
  };

  requstPromise(options)
    .then(function (resp) {
      var data = parseLeadData(resp);

      var mailOptions = {
        from: 'se.sg.demo@gmail.com',
        to: data['email'],
        subject: 'Hello from Garbage App!',
        text: 'Hello ' + data['full_name'] + ' ! How are you?'
      };

      transporter.sendMail(mailOptions, function(error, info){
        if (error) {
          data['response_status'] = error;
        } else {
          data['response_status'] = info.response;
        }
        received_leads.unshift(data);
      });
    })
    
    response.sendStatus(200);
  });

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

function parseLeadData(rawResp) {
  console.log(rawResp)
  var obj = {}
  var fieldData = rawResp.field_data;
  for (var i = 0; i < fieldData.length; i++) {
    obj[fieldData[i]['name']] = fieldData[i]['values']
  }
  return obj;
}
