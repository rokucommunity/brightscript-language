let brs = require('brs');
let lexResult = brs.lexer.Lexer.scan(`
sub countit()
    for each num in [1,2,3]
        print num
    next
end sub`);
let parseResult = brs.parser.Parser.parse(lexResult.tokens);
let errors =[...lexResult.errors, parseResult.errors]; 
//errors should be empty, but instead it contains several errors, one of which states "Expected 'end for' or 'next' to terminate for-loop block"
console.log(errors);