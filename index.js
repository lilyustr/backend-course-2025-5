const { program } = require('commander');

program
  .option('-n, --name <type>', 'Specify your name')
  .parse(process.argv);

console.log(program.opts());
