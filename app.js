'use strict';

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

const express = require('express'),
      request = require('request'),
      bodyParser = require('body-parser'),
      app = express().use(bodyParser.json());

let users = {};
const maxJokesPerDay = 10;


app.listen(process.env.PORT || 1337, () => console.log('Listening'));

app.post('/webhook', (req, res) => {

  let body = req.body;

  if ( body.object === 'page' ) {

    body.entry.forEach((entry) => {

      const event = entry.messaging[0];
      const senderId = event.sender.id;

      addUser(senderId);

      if ( event.message ) {
        processMessage( senderId, event.message );
      } else if ( event.postback ) {
        processPostback( senderId, event.postback );
      }
    })

    res.sendStatus(200);
  }
});

app.get('/webhook', (req, res) => {

  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  if ( mode && token ) {
    if ( mode === 'subscribe' && token === VERIFY_TOKEN ) {
      res.sendStatus(200);
    }
  } else {
    res.sendStatus(403);
  }

});


function addUser(senderId) {

  if ( !users[senderId] ) {
    users[senderId] = {
      jokeCount: 0,
      resetTime: 0
    }
  }
}

function processMessage(senderId, message) {

  if ( message.text ) {
    const formattedMsg = message.text.toLowerCase().trim();   

    console.log(formattedMsg);
    console.log(users);

    switch (formattedMsg) {
      case 'joke':
      case 'tell me a joke':
        handleJoke(senderId);
        break;
      case 'yes':
      case 'more':

        if ( users[senderId].jokeCount >= 1 ) {
          handleJoke(senderId);
        } else {
          sendMessage(senderId, 'Sorry, there are no jokes left.')
        }

        break;
      case 'help':
        sendMessage(senderId, `I am here to help: "Tell me a joke" - for me to tell you a joke. You have ${maxJokesPerDay - users[senderId].jokeCount} Jokes left - Enter "More Jokes" - for more jokes without waiting.`);
        break;
      case 'more jokes':
        users[senderId].jokeCount = 0;
        users[senderId].resetTime = 0;
        sendMessage(senderId, `I am ready to tell more jokes - Your joke count is now at ${users[senderId].jokeCount}.`)
        break;
      default:
        sendMessage(senderId, 'Hi - I am JokeBot | Ask "Tell me a joke" or "help".');
        break;
    }

  } else if ( message.attachments ) {
    sendMessage(senderId, 'Sorry, I do not know what to do with this.')
  }
}

function handleJoke(senderId) {
  const today = new Date();

  if ( users[senderId] ) {
    if ( users[senderId].jokeCount >= maxJokesPerDay ) {

      if ( users[senderId].resetTime === 0 ) {
        let tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        users[senderId].resetTime = tomorrow;

        sendMessage(senderId, `I do not have any jokes left - It takes me approximately 24h to find new ones.`);

      } else if ( users[senderId].resetTime >= today ) {
        let mLeft = (users[senderId].resetTime - today) / 1000 / 60;
        const hLeft = Math.floor(mLeft / 60);
        mLeft = Math.floor(mLeft % 60);

        sendMessage(senderId, `I do not have any jokes left - please wait ${hLeft}:${mLeft} for me to find more.`);
      } else {
        users[senderId].jokeCount = 0;
        users[senderId].resetTime = 0;

        sendMessage(senderId, `I am ready for more jokes. Ask "Tell me a joke"!`);
      }
 
    } else {
      users[senderId].jokeCount++;
      users[senderId].resetTime = 0;

      request({
        method: 'GET',
        uri: 'http://api.icndb.com/jokes/random'
      }, (err, res, body) => {
        if ( !err && res.statusCode == 200 ) {
          const data = JSON.parse(body);
          sendMessage(senderId, `"${data.value.joke}"  - Do you want "more"?`);
        }
      });
    }
  } 
}


function sendMessage(senderId, message) {
  const response = { "text": message };

  const request_body = {
    "recipient": {
      "id": senderId
    },
    "message": response
  }

  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log('message sent!')
    } else {
      console.error("Unable to send message:" + err);
    }
  }); 
}

