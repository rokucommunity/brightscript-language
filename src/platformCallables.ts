import { Callable } from './interfaces';
import { BrsFile } from './files/BrsFile';
import { platform } from 'os';

export let platformFile = new BrsFile('platform', 'platform');

let mathFunctions = [{
    name: 'Abs',
    shortDescription: 'Returns the absolute value of the argument.',
    type: 'function',
    returnType: 'float',
    file: platformFile,
    params: [{
        name: 'x',
        type: 'float'
    }]
}, {
    name: 'Atn',
    shortDescription: 'Returns the arctangent (in radians) of the argument.',
    documentation: '`ATN(X)` returns "the angle whose tangent is X". To get arctangent in degrees, multiply `ATN(X)` by `57.29578`.',
    type: 'function',
    returnType: 'float',
    file: platformFile,
    params: [{
        name: 'x',
        type: 'float'
    }]
}, {
    name: 'Cdbl',
    shortDescription: 'Returns a single precision float representation of the argument. Someday may return double.',
    type: 'function',
    returnType: 'float',
    file: platformFile,
    params: [{
        name: 'x',
        type: 'integer'
    }]
}, {
    name: 'Cint',
    shortDescription: 'Returns an integer representation of the argument, rounding up from midpoints. CINT(2.1) returns 2; CINT(2.5) returns 3; CINT(-2.2) returns -2; CINT(-2.5) returns -2; CINT(-2.6) returns -3.',
    type: 'function',
    returnType: 'integer',
    file: platformFile,
    params: [{
        name: 'x',
        type: 'float'
    }]
}, {
    name: 'Cos',
    shortDescription: 'Returns the cosine of the argument (argument must be in radians). To obtain the cosine of X when X is in degrees, use CGS(X*.01745329).',
    type: 'function',
    returnType: 'float',
    file: platformFile,
    params: [{
        name: 'x',
        type: 'float'
    }]
}, {
    name: 'Csng',
    shortDescription: 'Returns a single-precision float representation of the argument.',
    type: 'function',
    returnType: 'float',
    file: platformFile,
    params: [{
        name: 'x',
        type: 'integer'
    }]
}, {
    name: 'Exp',
    shortDescription: 'Returns the "natural exponential" of X, that is, ex. This is the inverse of the LOG function, so X=EXP(LOG(X)).',
    type: 'function',
    returnType: 'float',
    file: platformFile,
    params: [{
        name: 'x',
        type: 'float'
    }]
}, {
    name: 'Fix',
    shortDescription: 'Returns a truncated representation of the argument. All digits to the right of the decimal point are simply chopped off, so the resultant value is an integer. For non-negative X, FIX(X)=lNT(X). For negative values of X, FIX(X)=INT(X)+1. For example, FIX(2.2) returns 2, and FIX(-2.2) returns -2.',
    type: 'function',
    returnType: 'integer',
    file: platformFile,
    params: [{
        name: 'x',
        type: 'float'
    }]
}, {
    name: 'Int',
    shortDescription: 'Returns an integer representation of the argument, using the largest whole number that is not greater than the argument.. INT(2.5) returns 2; INT(-2.5) returns -3; and INT(1000101.23) returns 10000101.',
    type: 'function',
    returnType: 'integer',
    file: platformFile,
    params: [{
        name: 'x',
        type: 'float'
    }]
}, {
    name: 'Log',
    shortDescription: 'Returns the natural logarithm of the argument, that is, loge(x) or ln(x). This is the inverse of the EXP function, so LOG(EXP(X)) = X. To find the logarithm of a number to another base b, use the formula logb(X) = loge(X) / loge(b). For example, LOG(32767) / LOG(2) returns the logarithm to base 2 of 32767.',
    type: 'function',
    returnType: 'float',
    file: platformFile,
    params: [{
        name: 'x',
        type: 'float'
    }]
}, {
    name: 'Rnd',
    shortDescription: 'Generates a pseudo-random number using the current pseudo-random "seed number" (generated internally and not accessible to user).returns an integer between 1 and integer inclusive . For example, RND(55) returns a pseudo-random integer greater than zero and less than 56.',
    type: 'function',
    returnType: 'integer',
    file: platformFile,
    params: [{
        name: 'range',
        type: 'integer'
    }]
}, {
    name: 'Rnd',
    shortDescription: 'Generates a pseudo-random number using the current pseudo-random "seed number" (generated internally and not accessible to user). Returns a float value between 0 and 1.',
    type: 'function',
    returnType: 'float',
    file: platformFile,
    params: [{
        name: '0',
        type: 'integer'
    }]
}, {
    name: 'Sgn',
    shortDescription: 'The "sign" function: returns -1 for X negative, 0 for X zero, and +1 for X positive.',
    type: 'function',
    returnType: 'integer',
    file: platformFile,
    params: [{
        name: 'x',
        type: 'float'
    }]
}, {
    name: 'Sgn',
    shortDescription: 'The "sign" function: returns -1 for X negative, 0 for X zero, and +1 for X positive.',
    type: 'function',
    returnType: 'integer',
    file: platformFile,
    params: [{
        name: 'x',
        type: 'integer'
    }]
}, {
    name: 'Sin',
    shortDescription: 'Returns the sine of the argument (argument must be in radians). To obtain the sine of X when X is in degrees, use SIN(X*.01745329).',
    type: 'function',
    returnType: 'float',
    file: platformFile,
    params: [{
        name: 'x',
        type: 'float'
    }]
}, {
    name: 'Sqr',
    shortDescription: 'Returns the square root of the argument. SQR(X) is the same as X ^ (1/2), only faster.',
    type: 'function',
    returnType: 'float',
    file: platformFile,
    params: [{
        name: 'x',
        type: 'float'
    }]
}, {
    name: 'Tan',
    shortDescription: 'Returns the tangent of the argument (argument must be in radians). To obtain the tangent of X when X is in degrees, use TAN(X*.01745329).',
    type: 'function',
    returnType: 'float',
    file: platformFile,
    params: [{
        name: 'x',
        type: 'float'
    }]
}] as Callable[];

let runtimeFunctions = [{
    name: 'CreateObject',
    shortDescription: 'Creates a BrightScript Component of class classname specified. Return invalid if the object creation fails. Some Objects have optional parameters in their constructor that are passed after name.',
    type: 'function',
    returnType: 'object',
    file: platformFile,
    params: [{
        name: 'name',
        type: 'string'
    }, {
        name: 'parameters',
        type: 'object',
        isOptional: true
    }]
}, {
    name: 'Type',
    shortDescription: 'Returns the type of a variable and/or object. See the BrightScript Component specification for a list of types.',
    type: 'function',
    returnType: 'object',
    file: platformFile,
    params: [{
        name: 'variable',
        type: 'object'
    }, {
        name: 'version',
        type: 'string',
        isOptional: true
    }]
}, {
    name: 'GetGlobalAA',
    shortDescription: 'Each script has a global Associative Array. It can be fetched with this function. ',
    type: 'function',
    returnType: 'object',
    file: platformFile,
    params: []
}, {
    name: 'Box',
    shortDescription: 'Box() will return an object version of an intrinsic type, or pass through an object if given one.',
    type: 'function',
    returnType: 'object',
    file: platformFile,
    params: [{
        name: 'x',
        type: 'dynamic'
    }]
}, {
    name: 'Run',
    shortDescription: `The Run function can be used to compile and run a script dynamically.\nThe file specified by that path is compiled and run.\nArguments may be passed to the script's Main function, and that script may return a result value.'`,
    type: 'function',
    returnType: 'dynamic',
    file: platformFile,
    params: [{
        name: 'filename',
        type: 'string'
    }, {
        name: "arg",
        type: 'dynamic',
        isRestArgument: true
    }]
}, {
    name: 'Run',
    shortDescription: `The Run function can be used to compile and run a script dynamically.\nAll files specified are compiled together, then run.\nArguments may be passed to the script's Main function, and that script may return a result value.'`,
    type: 'function',
    returnType: 'dynamic',
    file: platformFile,
    params: [{
        name: 'filename',
        type: 'string[]'
    }, {
        name: "arg",
        type: 'dynamic',
        isRestArgument: true
    }]
}, {
    name: 'Eval',
    shortDescription: `Eval can be used to run a code snippet in the context of the current function. It performs a compile, and then the bytecode execution.\nIf a compilation error occurs, no bytecode execution is performed, and Eval returns an roList with one or more compile errors. Each list entry is an roAssociativeArray with ERRNO and ERRSTR keys describing the error.\nIf compilation succeeds, bytecode execution is performed and the integer runtime error code is returned. These are the same error codes as returned by GetLastRunRuntimeError().\nEval() can be usefully in two cases. The first is when you need to dynamically generate code at runtime.\nThe other is if you need to execute a statement that could result in a runtime error, but you don't want code execution to stop. '`,
    type: 'function',
    returnType: 'dynamic',
    file: platformFile,
    isDepricated: true,
    params: [{
        name: 'code',
        type: 'string'
    }]
}, {
    name: 'GetLastRunCompileError',
    shortDescription: 'Returns an roList of compile errors, or invalid if no errors. Each list entry is an roAssociativeArray with the keys: ERRNO, ERRSTR, FILESPEC, and LINENO.',
    type: 'function',
    returnType: 'object',
    file: platformFile,
    params: []
}, {
    name: 'GetLastRunRuntimeError',
    shortDescription: 'Returns an error code result after the last script Run().These are normal:\,&hFF==ERR_OKAY\n&hFC==ERR_NORMAL_END\n&hE2==ERR_VALUE_RETURN',
    type: 'function',
    returnType: 'integer',
    file: platformFile,
    params: []
}] as Callable[];

let globalUtilityFunctions = [
    {
        name: 'Sleep',
        shortDescription: 'This function causes the script to pause for the specified time, without wasting CPU cycles. There are 1000 milliseconds in one second.',
        type: 'function',
        returnType: 'void',
        file: platformFile,
        params: [{
            name: 'milliseconds',
            type: 'integer'
        }]
    }, {
        name: 'Wait',
        shortDescription: 'This function waits on objects that are "waitable" (those that have a MessagePort interface). Wait() returns the event object that was posted to the message port. If timeout is zero, "wait" will wait for ever. Otherwise, Wait will return after timeout milliseconds if no messages are received. In this case, Wait returns a type "invalid".',
        type: 'function',
        returnType: 'object',
        file: platformFile,
        params: [{
            name: 'timeout',
            type: 'integer'
        }, {
            name: 'port',
            type: 'object'
        }]
    }, {
        name: 'GetInterface',
        shortDescription: 'Each BrightScript Component has one or more interfaces. This function returns a value of type "Interface". \nNote that generally BrightScript Components allow you to skip the interface specification. In which case, the appropriate interface within the object is used. This works as long as the function names within the interfaces are unique.',
        type: 'function',
        returnType: 'interface',
        file: platformFile,
        params: [{
            name: 'object',
            type: 'object'
        }, {
            name: 'ifname',
            type: 'string'
        }]
    }, {
        name: 'FindMemberFunction',
        shortDescription: 'Returns the interface from the object that provides the specified function, or invalid if not found.',
        type: 'function',
        returnType: 'interface',
        file: platformFile,
        params: [{
            name: 'object',
            type: 'object'
        }, {
            name: 'functionName',
            type: 'string'
        }]
    }, {
        name: 'UpTime',
        shortDescription: 'Returns the uptime of the system since the last reboot in seconds.',
        type: 'function',
        returnType: 'float',
        file: platformFile,
        params: [{
            name: 'dummy',
            type: 'integer'
        }]
    }, {
        name: 'RebootSystem',
        shortDescription: 'Requests the system to perform a soft reboot. The Roku platform has disabled this feature.',
        type: 'function',
        returnType: 'void',
        file: platformFile,
        params: []
    }, {
        name: 'ListDir',
        shortDescription: 'Returns a List object containing the contents of the directory path specified.',
        type: 'function',
        returnType: 'object',
        file: platformFile,
        params: [{
            name: 'path',
            type: 'string'
        }]
    }, {
        name: 'ReadAsciiFile',
        shortDescription: 'This function reads the specified file and returns the data as a string.\nThe file can be encoded as either UTF-8 (which includes the 7-bit ASCII subset) or UTF-16.\nAn empty string is returned if the file can not be read.',
        type: 'function',
        returnType: 'string',
        file: platformFile,
        params: [{
            name: 'filePath',
            type: 'string'
        }]
    }, {
        name: 'WriteAsciiFile',
        shortDescription: 'This function writes the specified string data to a file at the specified location.\nThe string data is written as UTF-8 encoded (which includes the 7-bit ASCII subset).\nThe function returns true if the file was successfully written.',
        type: 'function',
        returnType: 'boolean',
        file: platformFile,
        params: [{
            name: 'filePath',
            type: 'string'
        }, {
            name: 'text',
            type: 'string'
        }]
    }, {
        name: 'CopyFile',
        shortDescription: 'Make a copy of a file.',
        type: 'function',
        returnType: 'boolean',
        file: platformFile,
        params: [{
            name: 'source',
            type: 'string'
        }, {
            name: 'destination',
            type: 'string'
        }]
    }, {
        name: 'MoveFile',
        shortDescription: 'Rename a file.',
        type: 'function',
        returnType: 'boolean',
        file: platformFile,
        params: [{
            name: 'source',
            type: 'string'
        }, {
            name: 'destination',
            type: 'string'
        }]
    }, {
        name: 'MatchFiles',
        shortDescription:
            `Search a directory for filenames that match a certain pattern. Pattern is a wildmat expression. Returns a List object.
This function checks all the files in the directory specified against the pattern specified and places any matches in the returned roList.

The returned list contains only the part of the filename that is matched against the pattern not the full path. 
The pattern may contain certain special characters:

A '?' matches any single character.
A '*' matches zero or more arbitrary characters.
The character class '[...]' matches any single character specified within the brackets. The closing bracket is treated as a member of the character class if it immediately follows the opening bracket. i.e. '[]]' matches a single close bracket. Within the class '-' can be used to specify a range unless it is the first or last character. e.g. '[A-Cf-h]' is equivalent to '[ABCfgh]'.
A character class can be negated by specifying '^' as the first character. To match a literal '^' place it elsewhere within the class.
The characters '?', '*' and '[' lose their special meaning if preceded by a single '\'. A single '\' can be matched as '\\'.`,
        type: 'function',
        returnType: 'string[]',
        file: platformFile,
        params: [{
            name: 'path',
            type: 'string'
        }, {
            name: 'pattern_in',
            type: 'string'
        }]
    }, {
        name: 'DeleteFile',
        shortDescription: 'Delete the specified file.',
        type: 'function',
        returnType: 'boolean',
        file: platformFile,
        params: [{
            name: 'file',
            type: 'string'
        }]
    }, {
        name: 'DeleteDirectory',
        shortDescription: 'Deletes the specified directory.  It is only possible to delete an empty directory.',
        type: 'function',
        returnType: 'boolean',
        file: platformFile,
        params: [{
            name: 'dir',
            type: 'string'
        }]
    }, {
        name: 'CreateDirectory',
        shortDescription: 'Creates the specified Directory. Only one directory can be created at a time',
        type: 'function',
        returnType: 'boolean',
        file: platformFile,
        params: [{
            name: 'dir',
            type: 'string'
        }]
    }, {
        name: 'FormatDrive',
        shortDescription: 'Formats a specified drive using the specified filesystem.',
        type: 'function',
        returnType: 'boolean',
        file: platformFile,
        params: [{
            name: 'drive',
            type: 'string'
        }, {
            name: 'fs_type',
            type: 'string'
        }]
    }, {
        name: 'StrToI',
        shortDescription: 'Return the integer value of the string, or 0 if nothing is parsed.',
        type: 'function',
        returnType: 'integer',
        file: platformFile,
        params: [{
            name: 'str',
            type: 'string'
        }]
    }, {
        name: 'RunGarbageCollector',
        shortDescription: `This function runs the garbage collector. It returns and Associative Array with some statistics regarding the garbage collection. \nSee the Garbage Collection section of the manual for more detail. You don't normally need to call this function.`,
        type: 'function',
        returnType: 'object',
        file: platformFile,
        params: []
    }, {
        name: 'ParseJson',
        shortDescription:
            `This function will parse a string formatted according to RFC4627 and return an equivalent BrightScript object (consisting of booleans, integer and floating point numbers, strings, roArray, and roAssociativeArray objects).  If the string is not syntactically correct, Invalid will be returned.  A few other things to note:

Any roAssociativeArray objects in the returned objects will be case sensitive.
An error will be returned if arrays/associative arrays are nested more than 256 levels deep.`,
        type: 'function',
        returnType: 'object',
        file: platformFile,
        params: [{
            name: 'jsonString',
            type: 'string'
        }]
    }, {
        name: 'FormatJson',
        shortDescription:
            `Formats a supported data type as a JSON string.

Data types supported are booleans, integer and floating point numbers, strings, roArray, and roAssociativeArray objects.

An error will be returned if arrays/associative arrays are nested more than 256 levels deep.

If an error occurs an empty string will be returned.

Normally non-ASCII characters are escaped in the output string as "\\uXXXX" where XXXX is the hexadecimal representation of the Unicode character value.  If flags=1, non-ASCII characters are not escaped.`,
        type: 'function',
        returnType: '',
        file: platformFile,
        params: [{
            name: 'object',
            type: 'object'
        }, {
            name: 'flags',
            type: 'string',
            isOptional: true
        }]
    }, {
        name: 'Tr',
        shortDescription:
            `Translates the source string into the language of the current locale. The function looks for a translations.xml file in the XLIFF format in the pkg:/locale subdirectory named for the current locale (see ifDeviceInfo.GetCurrentLocale for the list of currently-supported locales). If the translations.xml file exists for the current locale, and contains the source string with a translated string, the function returns the translated string. Otherwise, the function returns the original source string.

In some cases you may want to include a placeholder marker in a localizable string that gets dynamically substituted with a value at runtime. 
One way to accomplish that is to use the Replace method on the string value returned from the Tr() lookup.`,
        type: 'function',
        returnType: 'string',
        file: platformFile,
        params: [{
            name: 'source',
            type: 'string'
        }]
    }
] as Callable[];

let globalStringFunctions = [
    {
        name: 'UCase',
        shortDescription: 'Converts the string to all upper case.',
        type: 'function',
        returnType: 'string',
        file: platformFile,
        params: [{
            name: 's',
            type: 'string'
        }]
    }, {
        name: 'LCase',
        shortDescription: 'Converts the string to all lower case.',
        type: 'function',
        returnType: 'string',
        file: platformFile,
        params: [{
            name: 's',
            type: 'string'
        }]
    }, {
        name: 'Asc',
        shortDescription: 'Returns the Unicode ("ASCII") value for the first character of the specified string\n An empty string argument will return 0.',
        type: 'function',
        returnType: 'integer',
        file: platformFile,
        params: [{
            name: 'letter',
            type: 'string'
        }]
    }, {
        name: 'Chr',
        shortDescription:
            `Performs the inverse of the Asc function: returns a one-character string whose character has the specified Unicode value. Returns empty string if the specified value is 0 or an invalid Unicode value.
 
 print Chr(67) ' prints: C

By using Chr, you can create strings containing characters which cannot be contained in quotes, such as newline or the quote character itself.

 print (Chr(34) + "hello" + Chr(34))  ' prints: "hello"`,
        type: 'function',
        returnType: 'string',
        file: platformFile,
        params: [{
            name: 'ch',
            type: 'integer'
        }]
    }, {
        name: 'Instr',
        shortDescription: 'Returns the position of the first instances of substring within text, starting at the specified start position.\nReturns 0 if the substring is not found. Unlike the ifString.Instr() method, the first position is 1.',
        type: 'function',
        returnType: 'integer',
        file: platformFile,
        params: [{
            name: 'start',
            type: 'integer'
        }, {
            name: 'text',
            type: 'string'
        }, {
            name: 'substring',
            type: 'string'
        }]
    }, {
        name: 'Left',
        shortDescription: 'Returns the first n characters of s. ',
        type: 'function',
        returnType: 'integer',
        file: platformFile,
        params: [{
            name: 's',
            type: 'string'
        }]
    }, {
        name: 'Len',
        shortDescription: 'Returns the number of characters in the specified string.',
        type: 'function',
        returnType: 'integer',
        file: platformFile,
        params: [{
            name: 's',
            type: 'string'
        }]
    }, {
        name: 'Mid',
        shortDescription: 'Returns a substring of s with length n and starting at position p.\nn may be omitted, in which case the string starting at p and ending at the end of the string is returned.\nUnlike the ifString.Mid() method, the first character in the string is position 1.',
        type: 'function',
        returnType: 'string',
        file: platformFile,
        params: [{
            name: 's',
            type: 'string'
        }, {
            name: 'p',
            description: '1-based position',
            type: 'integer'
        }, {
            name: 'n',
            type: 'integer',
            isOptional: true
        }]
    }, {
        name: 'Right',
        shortDescription: 'Returns the last n characters of s.',
        type: 'function',
        returnType: 'string',
        file: platformFile,
        params: [{
            name: 's',
            type: ''
        }, {
            name: 'n',
            type: 'integer'
        }]
    }, {
        name: 'Str',
        shortDescription: 'Converts a value to a string. Str(A), for example, returns a string equal to the decimal representation of the numeric value of A.\nNote: for non-negative numbers, a leading blank is inserted before the value string as a sign placeholder.',
        type: 'function',
        returnType: 'string',
        file: platformFile,
        params: [{
            name: 'value',
            type: 'float'
        }]
    }, {
        name: 'StrI',
        shortDescription: 'Converts a value to a string. Str(A), for example, returns a string equal to the decimal representation of the numeric value of A.\nNote: for non-negative numbers, a leading blank is inserted before the value string as a sign placeholder.',
        type: 'function',
        returnType: 'string',
        file: platformFile,
        params: [{
            name: 'value',
            type: 'integer'
        }]
    }, {
        name: 'StrI',
        shortDescription: 'Converts the integer value into a string representation using the given radix.\nIf radix is not 2 .. 36 then an empty string is returned.\nNote that the returned string does not include a base prefix and uses lowercase letters to represent those digits in bases greater than 10.',
        type: 'function',
        returnType: 'string',
        file: platformFile,
        params: [{
            name: 'value',
            type: 'integer'
        }, {
            name: 'radix',
            type: 'integer'
        }]
    }, {
        name: 'String',
        shortDescription: 'Returns a string composed of n copies of the second argument concatenated together.',
        type: 'function',
        returnType: 'string',
        file: platformFile,
        params: [{
            name: 'n',
            type: 'integer'
        }, {
            name: 'str',
            type: 'string'
        }]
    }, {
        name: 'StringI',
        shortDescription: 'Returns a string composed of n copies of the character whose Unicode value is the second argument.',
        type: 'function',
        returnType: '',
        file: platformFile,
        params: [{
            name: 'n',
            type: 'integer'
        }, {
            name: 'ch',
            type: 'integer'
        }]
    }, {
        name: 'Val',
        shortDescription: 'Performs the inverse of the STR function: returns the number represented by the characters in a string argument.\nFor example, if A$="12" and B$="34" then VAL(A$+ "."+B$) returns the number 12.34.',
        type: 'function',
        returnType: 'float',
        file: platformFile,
        params: [{
            name: 's',
            type: 'string'
        }]
    }, {
        name: 'Val',
        shortDescription: 'Returns the integer value from parsing the string with the specified radix.\nRadix should be 2 .. 36 or the special value 0 (which automatically identified hexadecimal or octal numbers based on 0x or 0 prefixes respectively).\nLeading whitespace is ignored then as much of the rest of the string will be parsed as valid.',
        type: 'function',
        returnType: 'integer',
        file: platformFile,
        params: [{
            name: 'str',
            type: 'string'
        }, {
            name: 'radix',
            type: 'integer'
        }]
    }, {
        name: 'Substitute',
        shortDescription: 'Replaces all instances of {0} or ^0 in str with arg0.  Similarly, replaces all instances of {1} or ^1 with arg1, {2} or ^2 with arg2, and {3} or ^3 with arg3.',
        type: 'function',
        returnType: 'string',
        file: platformFile,
        params: [{
            name: 'str',
            type: 'string'
        }, {
            name: 'arg0',
            type: 'string'
        }, {
            name: 'arg1',
            type: 'string'
        }, {
            name: 'arg2',
            type: 'string'
        }, {
            name: 'arg3',
            type: 'string'
        }]
    }
] as Callable[];
export var platformCallables = [...mathFunctions, ...runtimeFunctions, ...globalUtilityFunctions, ...globalStringFunctions];
platformFile.callables = platformCallables;