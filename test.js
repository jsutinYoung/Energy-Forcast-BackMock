const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const sampleData = require('./data/week_data.json');
const moment = require('moment');

function print(str) {
  console.log(str);
}

// print(1);
// let m = moment('01-01-2017 00:00:00', 'MM-DD-YYYY hh:mm:s')
// print(m.format('MM-DD-YYYY HH:mm:ss'));
// print(m.local().toDate().getTime());

// print(2);
// let m2 = m.clone();
// let text = m2.clone().utc().format('MM-DD-YYYY HH:mm:ss');
// print(text); //for printing does not change inside
// print(m2.clone().utc().toDate().getTime());//does not change inside
// let m10 = moment.utc('01-01-2017 08:00:00', 'MM-DD-YYYY HH:mm:ss');
// print(m10.toDate().getTime());

// print(m.clone().format('MM-DD-YYYY HH:mm:ss'))

// print(3);
// let m3 = m.clone();
// print(m3.local().format('MM-DD-YYYY HH:mm:ss'));
// print(m3.local().toDate().getTime());

// print(4);
// //read as utc
// let m5 = moment.utc('01-01-2017 00:00:00', 'MM-DD-YYYY hh:mm:s');
// print(m5.format('MM-DD-YYYY HH:mm:ss')); //01-01-2017 00:00:00 print whatever format is.
// print(m5.toDate().getTime()); //1483228800000 native
// print(m5.local().format('MM-DD-YYYY HH:mm:ss'));//12-31-2016 16:00:00 print in local
// print(m5.local().toDate().getTime()); //1483228800000 does not change
// print(m5.isUTC());
// //local() printing.

// print(5);
// let m6 = m.clone();
// print(m6.local().format('MM-DD-YYYY HH:mm:ss'));
// print(m6.local().toDate().getTime());

// print(6);
// let m7 = m5.clone();
// // m7.add(+m7.utcOffset(), 'm');
// print(m7.format('MM-DD-YYYY HH:mm:ss'));
// print(m7.toDate().getTime());

// let n = moment.utc('03-11-2018 00:00:00', 'MM-DD-YYYY hh:mm:s');
// print(n.format('MM-DD-YYYY HH:mm:ss'));
// print(n.toDate().getTime());
// print(n.isUTC());
// print(n.utc().format('MM-DD-YYYY HH:mm:ss'));
// print(n.isUTC());
// print(n.toDate().getTime());
// print(n.format('MM-DD-YYYY HH:mm:ss'));

let n = moment('11-04-2018 00:00:00', 'MM-DD-YYYY hh:mm:ss');
let m = n.clone().utc();
let u = moment.utc('11-04-2018 07:00:00', 'MM-DD-YYYY hh:mm:ss');

print('--------------------------');
for (let i = 0; i <= 24; i++) {
  print(n.format('MM-DD-YYYY HH:mm:ss'));
  print(n.toDate().getTime());
  print('++');
  print(m.format('MM-DD-YYYY HH:mm:ss'));
  print(m.toDate().getTime());
  print('++');
  print(u.format('MM-DD-YYYY HH:mm:ss'));
  print(u.toDate().getTime());
  // let n2 = n.clone();
  // print(n.utc().format('MM-DD-YYYY HH:mm:ss'));
  // print(n.toDate().getTime());

  print('--------------------------');
  n.add(1, 'hour');
  m.add(1, 'hour');
  u.add(1, 'hour');
}

let x = moment('01-01-2017 00:00:00', 'MM-DD-YYYY hh:mm:ss');
print(x.format('MM-DD-YYYY HH:mm:ss'));
print(x.toDate().getTime());
let y = x.clone().utc();
print(y.format('MM-DD-YYYY HH:mm:ss'));
print(y.toDate().getTime());

let gen_date = moment('01-01-2018 00:00:00', 'MM-DD-YYYY hh:mm:ss');
for (let year = 2018; year <= 2018; year++) {
  for (let month = 1; month <= 12; month++) {
    let daysInMonth = gen_date.daysInMonth();
    for (let d = 1; d <= daysInMonth; d++){
      const current = gen_date.date(d);
      print(current);
    }
    gen_date.add(1, 'month');
  }
}
