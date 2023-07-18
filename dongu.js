function awaitTimeout(delay) {
  return new Promise(function(resolve, reject) {
    setTimeout(resolve, delay);
  });
}

function loop(msg, i, resolve) {
  if (i == msg.length) return resolve;
  return awaitTimeout(200)
    .then(function() {
      console.log(msg.substring(0, i));
      return loop(msg, i + 1, resolve);
    });
}

awaitTimeout(3000)
  .then(function() {
    return new Promise(function(resolve) {
      loop("Hello World, this is a Loop.", 1).then(()=>console.log('The End'))
    })
  })
  .catch();