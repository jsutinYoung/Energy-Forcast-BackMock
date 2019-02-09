const sampleData = require('./data/week_data.json');
const moment = require('moment');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

//....................................................................................
function randomIntFromInterval(min, max) {
  // min and max included
  return Math.floor(Math.random() * (max - min + 1) + min);
}
//....................................................................................
function mockData(m) {
  const variabtion1 = 1 + Math.floor(Math.random() * 11) / 100.0;
  const variabtion2 = 1 + Math.floor(Math.random() * 11) / 100.0;
  const variabtion3 = 1 + Math.floor(Math.random() * 11) / 100.0;

  let temp;
  const month = m.month();
  if (month >= 0 && month <= 2) {
    temp = randomIntFromInterval(28, 45);
  } else if (month >= 3 && month <= 5) {
    temp = randomIntFromInterval(34, 52);
  } else if (month >= 6 && month <= 8) {
    temp = randomIntFromInterval(40, 105);
  } else {
    temp = randomIntFromInterval(38, 50);
  }

  return [variabtion1, variabtion2, variabtion3, temp];
}

function addUser(DB) {
  DB.exec('BEGIN');
  const stmt2 = DB.prepare('INSERT INTO users VALUES (?,?,?)');
  stmt2.run('j@j.com', '111111', 2);
  DB.exec('COMMIT');
}
async function createDB() {
  try {
    const filePath = './data/comparisons.db';
    fs.unlinkSync(filePath);
  } catch (err) {}

  // console.log(moment('12-31-2017', 'MMDDYYYY').isoWeek());
  let DB = new sqlite3.Database(
    './data/comparisons.db',
    sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
    err => {
      if (err) {
        console.error(err.message);
      }
    }
  );

  DB.serialize(() => {
    DB.run(
      'CREATE TABLE IF NOT EXISTS comparisons (hour INTEGER PRIMARY KEY, forecast REAL, baseline REAL, stderr REAL, temperature REAL);'
    );

    DB.run(
      'CREATE TABLE IF NOT EXISTS `users` ( `email` TEXT NOT NULL, `password` TEXT NOT NULL, `type` INTEGER NOT NULL, PRIMARY KEY(`email`) )'
    );

    DB.run(
      'CREATE TABLE IF NOT EXISTS `forecasts` (`time`	INTEGER NOT NULL UNIQUE,PRIMARY KEY(`time`))'
    );

    DB.run(
      'CREATE TABLE IF NOT EXISTS `loads` ( `time` INTEGER, `actual` REAL, PRIMARY KEY(`time`))'
    );

    DB.run(
      'CREATE TABLE IF NOT EXISTS `sevendays` ( `time` INTEGER, `forecast` REAL, `stderr` REAL, `temperature` REAL, `gen_time` INTEGER NOT NULL, FOREIGN KEY(`gen_time`) REFERENCES `forecasts`(`time`))'
    );

    DB.run(
      'CREATE TABLE IF NOT EXISTS `sevendays` ( `time` INTEGER, `forecast` REAL, `stderr` REAL, `temperature` REAL, `gen_time` INTEGER NOT NULL, FOREIGN KEY(`gen_time`) REFERENCES `forecasts`(`time`))'
    );

    DB.run('CREATE INDEX `idx1` ON `sevendays` ( `gen_time`	ASC)');

    addUser(DB);

    //generate on local time bondary
    // let gen_date = moment.utc('01-01-2017 00:00:00', 'MM-DD-YYYY hh:mm:s');
    // let gen_date = moment.utc('01-01-2017 08:00:00', 'MM-DD-YYYY hh:mm:s');

    let prevvalue = 0;

    let mydate = moment('01-01-2017 00:00:00', 'MM-DD-YYYY hh:mm:ss');
    for (let year = 2017; year <= 2019; year++) {
      for (let month = 1; month <= 12; month++) {
        const daysInMonth = mydate.daysInMonth();
        //all days in a month
        for (let ddd = 1; ddd <= daysInMonth; ddd++) {
          const gen_date = mydate.date(ddd);
          //   console.log(gen_date);

          DB.exec('BEGIN');
          //execute this every day
          let gen_time = gen_date.toDate().getTime();
          let stmt1 = DB.prepare('INSERT INTO forecasts VALUES(?)');
          stmt1.run(gen_time);
          stmt1.finalize();

          //produce 7 days forcast worth data
          let gen_moment = gen_date.clone();
          for (let hr = 0; hr < 168; hr++) {
            [d, f, b, e] = sampleData[hr];
            const h = gen_moment.toDate();

            [variabtion1, variabtion2, variabtion3, temp] = mockData(gen_moment);

            const stmt2 = DB.prepare('INSERT INTO sevendays VALUES (?,?,?,?,?)');
            stmt2.run(
              h.getTime(),
              parseFloat(f) * variabtion1,
              parseFloat(e) * variabtion3,
              temp,
              //foreign key
              gen_time
            );

            gen_moment.add(1, 'hour');
            stmt2.finalize();
            // console.log(`${counter++}  ${h}`);
          }

          // simulate 24 hr values
          let m = gen_date.clone();
          for (let hr = 0; hr < 24; hr++) {
            [d, f, b, e] = sampleData[hr];
            const h = m.toDate();

            if (prevvalue === h.getTime()) continue;
            prevvalue = h.getTime();

            //loads table
            [variabtion1, variabtion2, variabtion3, temp] = mockData(m);
            let stmt3 = DB.prepare('INSERT INTO loads VALUES(?,?)');
            stmt3.run(h.getTime(), parseFloat(b) * variabtion2);
            stmt3.finalize();

            //old comparisons table
            const stmt4 = DB.prepare('INSERT INTO comparisons VALUES (?,?,?,?,?)');
            stmt4.run(
              h.getTime(),
              parseFloat(f) * variabtion1,
              parseFloat(b) * variabtion2,
              parseFloat(e) * variabtion3,
              temp
            );

            m.add(1, 'hour');
            stmt4.finalize();
          }
          DB.exec('COMMIT');
        }
        mydate.add(1, 'month');
      }
    }
  });

  DB.close(err => {
    if (err) {
      console.error(err.message);
    }
  });
}

createDB();
