import { BRSCallable } from './interfaces';
import { BRSFile } from './BRSFile';

let globalFile = new BRSFile('global', 'global');

let mathFunctions = [{
    name: 'Abs',
    description: 'Returns the absolute value of the argument.',
    type: 'function',
    returnType: 'float',
    file: globalFile,
    params: [{
        name: 'x',
        type: 'float'
    }]
}, {
    name: 'Atn',
    description: 'Returns the arctangent (in radians) of the argument; that is, ATN(X) returns "the angle whose tangent is X". To get arctangent in degrees, multiply ATN(X) by 57.29578.',
    type: 'function',
    returnType: 'float',
    file: globalFile,
    params: [{
        name: 'x',
        type: 'float'
    }]
}, {
    name: 'Cdbl',
    description: 'Returns a single precision float representation of the argument. Someday may return double.',
    type: 'function',
    returnType: 'float',
    file: globalFile,
    params: [{
        name: 'x',
        type: 'integer'
    }]
}, {
    name: 'Cint',
    description: 'Returns an integer representation of the argument, rounding up from midpoints. CINT(2.1) returns 2; CINT(2.5) returns 3; CINT(-2.2) returns -2; CINT(-2.5) returns -2; CINT(-2.6) returns -3.',
    type: 'function',
    returnType: 'integer',
    file: globalFile,
    params: [{
        name: 'x',
        type: 'float'
    }]
}, {
    name: 'Cos',
    description: 'Returns the cosine of the argument (argument must be in radians). To obtain the cosine of X when X is in degrees, use CGS(X*.01745329).',
    type: 'function',
    returnType: 'float',
    file: globalFile,
    params: [{
        name: 'x',
        type: 'float'
    }]
}, {
    name: 'Csng',
    description: 'Returns a single-precision float representation of the argument.',
    type: 'function',
    returnType: 'float',
    file: globalFile,
    params: [{
        name: 'x',
        type: 'integer'
    }]
}, {
    name: 'Exp',
    description: 'Returns the "natural exponential" of X, that is, ex. This is the inverse of the LOG function, so X=EXP(LOG(X)).',
    type: 'function',
    returnType: 'float',
    file: globalFile,
    params: [{
        name: 'x',
        type: 'float'
    }]
}, {
    name: 'Fix',
    description: 'Returns a truncated representation of the argument. All digits to the right of the decimal point are simply chopped off, so the resultant value is an integer. For non-negative X, FIX(X)=lNT(X). For negative values of X, FIX(X)=INT(X)+1. For example, FIX(2.2) returns 2, and FIX(-2.2) returns -2.',
    type: 'function',
    returnType: 'integer',
    file: globalFile,
    params: [{
        name: 'x',
        type: 'float'
    }]
}, {
    name: 'Int',
    description: 'Returns an integer representation of the argument, using the largest whole number that is not greater than the argument.. INT(2.5) returns 2; INT(-2.5) returns -3; and INT(1000101.23) returns 10000101.',
    type: 'function',
    returnType: 'integer',
    file: globalFile,
    params: [{
        name: 'x',
        type: 'float'
    }]
}, {
    name: 'Log',
    description: 'Returns the natural logarithm of the argument, that is, loge(x) or ln(x). This is the inverse of the EXP function, so LOG(EXP(X)) = X. To find the logarithm of a number to another base b, use the formula logb(X) = loge(X) / loge(b). For example, LOG(32767) / LOG(2) returns the logarithm to base 2 of 32767.',
    type: 'function',
    returnType: 'float',
    file: globalFile,
    params: [{
        name: 'x',
        type: 'float'
    }]
}, {
    name: 'Rnd',
    description: 'Generates a pseudo-random number using the current pseudo-random "seed number" (generated internally and not accessible to user).returns an integer between 1 and integer inclusive . For example, RND(55) returns a pseudo-random integer greater than zero and less than 56.',
    type: 'function',
    returnType: 'integer',
    file: globalFile,
    params: [{
        name: 'range',
        type: 'integer'
    }]
}, {
    name: 'Rnd',
    description: 'Generates a pseudo-random number using the current pseudo-random "seed number" (generated internally and not accessible to user). Returns a float value between 0 and 1.',
    type: 'function',
    returnType: 'float',
    file: globalFile,
    params: [{
        name: '0',
        type: 'integer'
    }]
}, {
    name: 'Sgn',
    description: 'The "sign" function: returns -1 for X negative, 0 for X zero, and +1 for X positive.',
    type: 'function',
    returnType: 'integer',
    file: globalFile,
    params: [{
        name: 'x',
        type: 'float'
    }]
}, {
    name: 'Sgn',
    description: 'The "sign" function: returns -1 for X negative, 0 for X zero, and +1 for X positive.',
    type: 'function',
    returnType: 'integer',
    file: globalFile,
    params: [{
        name: 'x',
        type: 'integer'
    }]
}, {
    name: 'Sin',
    description: 'Returns the sine of the argument (argument must be in radians). To obtain the sine of X when X is in degrees, use SIN(X*.01745329).',
    type: 'function',
    returnType: 'float',
    file: globalFile,
    params: [{
        name: 'x',
        type: 'float'
    }]
}, {
    name: 'Sqr',
    description: 'Returns the square root of the argument. SQR(X) is the same as X ^ (1/2), only faster.',
    type: 'function',
    returnType: 'float',
    file: globalFile,
    params: [{
        name: 'x',
        type: 'float'
    }]
}, {
    name: 'Tan',
    description: 'Returns the tangent of the argument (argument must be in radians). To obtain the tangent of X when X is in degrees, use TAN(X*.01745329).',
    type: 'function',
    returnType: 'float',
    file: globalFile,
    params: [{
        name: 'x',
        type: 'float'
    }]
}] as BRSCallable[];

let runtimeFunctions = [{
    name: 'CreateObject',
    description: 'Creates a BrightScript Component of class classname specified. Return invalid if the object creation fails. Some Objects have optional parameters in their constructor that are passed after name.',
    type: 'function',
    returnType: 'object',
    file: globalFile,
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
    description: 'Returns the type of a variable and/or object. See the BrightScript Component specification for a list of types.',
    type: 'function',
    returnType: 'object',
    file: globalFile,
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
    description: 'Each script has a global Associative Array. It can be fetched with this function. ',
    type: 'function',
    returnType: 'object',
    file: globalFile,
    params: []
}, {
    name: 'Box',
    description: 'Box() will return an object version of an intrinsic type, or pass through an object if given one.',
    type: 'function',
    returnType: 'object',
    file: globalFile,
    params: [{
        name: 'x',
        type: 'dynamic'
    }]
}, {
    name: 'Run',
    description: `The Run function can be used to compile and run a script dynamically.\nThe file specified by that path is compiled and run.\nArguments may be passed to the script's Main function, and that script may return a result value.'`,
    type: 'function',
    returnType: 'dynamic',
    file: globalFile,
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
    description: `The Run function can be used to compile and run a script dynamically.\nAll files specified are compiled together, then run.\nArguments may be passed to the script's Main function, and that script may return a result value.'`,
    type: 'function',
    returnType: 'dynamic',
    file: globalFile,
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
    description: `Eval can be used to run a code snippet in the context of the current function. It performs a compile, and then the bytecode execution.\nIf a compilation error occurs, no bytecode execution is performed, and Eval returns an roList with one or more compile errors. Each list entry is an roAssociativeArray with ERRNO and ERRSTR keys describing the error.\nIf compilation succeeds, bytecode execution is performed and the integer runtime error code is returned. These are the same error codes as returned by GetLastRunRuntimeError().\nEval() can be usefully in two cases. The first is when you need to dynamically generate code at runtime.\nThe other is if you need to execute a statement that could result in a runtime error, but you don't want code execution to stop. '`,
    type: 'function',
    returnType: 'dynamic',
    file: globalFile,
    isDepricated: true,
    params: [{
        name: 'code',
        type: 'string'
    }]
}, {
    name: 'GetLastRunCompileError',
    description: 'Returns an roList of compile errors, or invalid if no errors. Each list entry is an roAssociativeArray with the keys: ERRNO, ERRSTR, FILESPEC, and LINENO.',
    type: 'function',
    returnType: 'object',
    file: globalFile,
    params: []
}, {
    name: 'GetLastRunRuntimeError',
    description: 'Returns an error code result after the last script Run().These are normal:\,&hFF==ERR_OKAY\n&hFC==ERR_NORMAL_END\n&hE2==ERR_VALUE_RETURN',
    type: 'function',
    returnType: 'integer',
    file: globalFile,
    params: []
}] as BRSCallable[];

let globalUtilityFunctions = [
    {
        name: 'Sleep',
        description: 'This function causes the script to pause for the specified time, without wasting CPU cycles. There are 1000 milliseconds in one second.',
        type: 'function',
        returnType: 'void',
        file: globalFile,
        params: [{
            name: 'milliseconds',
            type: 'integer'
        }]
    }, {
        name: 'Wait',
        description: 'This function waits on objects that are "waitable" (those that have a MessagePort interface). Wait() returns the event object that was posted to the message port. If timeout is zero, "wait" will wait for ever. Otherwise, Wait will return after timeout milliseconds if no messages are received. In this case, Wait returns a type "invalid".',
        type: 'function',
        returnType: 'object',
        file: globalFile,
        params: [{
            name: 'timeout',
            type: 'integer'
        }, {
            name: 'port',
            type: 'object'
        }]
    }, {
        name: 'GetInterface',
        description: 'Each BrightScript Component has one or more interfaces. This function returns a value of type "Interface". \nNote that generally BrightScript Components allow you to skip the interface specification. In which case, the appropriate interface within the object is used. This works as long as the function names within the interfaces are unique.',
        type: 'function',
        returnType: 'interface',
        file: globalFile,
        params: [{
            name: 'object',
            type: 'object'
        }, {
            name: 'ifname',
            type: 'string'
        }]
    }, {
        name: 'FindMemberFunction',
        description: 'Returns the interface from the object that provides the specified function, or invalid if not found.',
        type: 'function',
        returnType: 'interface',
        file: globalFile,
        params: [{
            name: 'object',
            type: 'object'
        }, {
            name: 'functionName',
            type: 'string'
        }]
    }, {
        name: 'UpTime',
        description: 'Returns the uptime of the system since the last reboot in seconds.',
        type: 'function',
        returnType: 'float',
        file: globalFile,
        params: [{
            name: 'dummy',
            type: 'integer'
        }]
    }, {
        name: 'RebootSystem',
        description: 'Requests the system to perform a soft reboot. The Roku platform has disabled this feature.',
        type: 'function',
        returnType: 'void',
        file: globalFile,
        params: []
    }, {
        name: 'ListDir',
        description: 'Returns a List object containing the contents of the directory path specified.',
        type: 'function',
        returnType: 'object',
        file: globalFile,
        params: [{
            name: 'path',
            type: 'string'
        }]
    }, {
        name: 'ReadAsciiFile',
        description: 'This function reads the specified file and returns the data as a string.\nThe file can be encoded as either UTF-8 (which includes the 7-bit ASCII subset) or UTF-16.\nAn empty string is returned if the file can not be read.',
        type: 'function',
        returnType: 'string',
        file: globalFile,
        params: [{
            name: 'filePath',
            type: 'string'
        }]
    }, {
        name: 'WriteAsciiFile',
        description: 'This function writes the specified string data to a file at the specified location.\nThe string data is written as UTF-8 encoded (which includes the 7-bit ASCII subset).\nThe function returns true if the file was successfully written.',
        type: 'function',
        returnType: 'boolean',
        file: globalFile,
        params: [{
            name: 'filePath',
            type: 'string'
        }, {
            name: 'text',
            type: 'string'
        }]
    }, {
        name: 'CopyFile',
        description: 'Make a copy of a file.',
        type: 'function',
        returnType: 'boolean',
        file: globalFile,
        params: [{
            name: 'source',
            type: 'string'
        }, {
            name: 'destination',
            type: 'string'
        }]
    }, {
        name: 'MoveFile',
        description: 'Rename a file.',
        type: 'function',
        returnType: 'boolean',
        file: globalFile,
        params: [{
            name: 'source',
            type: 'string'
        }, {
            name: 'destination',
            type: 'string'
        }]
    }, {
        name: 'MatchFiles',
        description:
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
        file: globalFile,
        params: [{
            name: 'path',
            type: 'string'
        }, {
            name: 'pattern_in',
            type: 'string'
        }]
    }, {
        name: 'DeleteFile',
        description: 'Delete the specified file.',
        type: 'function',
        returnType: 'boolean',
        file: globalFile,
        params: [{
            name: 'file',
            type: 'string'
        }]
    }, {
        name: 'DeleteDirectory',
        description: 'Deletes the specified directory.  It is only possible to delete an empty directory.',
        type: 'function',
        returnType: 'boolean',
        file: globalFile,
        params: [{
            name: 'dir',
            type: 'string'
        }]
    }, {
        name: 'CreateDirectory',
        description: 'Creates the specified Directory. Only one directory can be created at a time',
        type: 'function',
        returnType: 'boolean',
        file: globalFile,
        params: [{
            name: 'dir',
            type: 'string'
        }]
    }, {
        name: 'FormatDrive',
        description: 'Formats a specified drive using the specified filesystem.',
        type: 'function',
        returnType: 'boolean',
        file: globalFile,
        params: [{
            name: 'drive',
            type: 'string'
        }, {
            name: 'fs_type',
            type: 'string'
        }]
    }, {
        name: '',
        description: '',
        type: 'function',
        returnType: '',
        file: globalFile,
        params: [{
            name: '',
            type: ''
        }]
    }, {
        name: '',
        description: '',
        type: 'function',
        returnType: '',
        file: globalFile,
        params: [{
            name: '',
            type: ''
        }]
    }, {
        name: '',
        description: '',
        type: 'function',
        returnType: '',
        file: globalFile,
        params: [{
            name: '',
            type: ''
        }]
    }, {
        name: '',
        description: '',
        type: 'function',
        returnType: '',
        file: globalFile,
        params: [{
            name: '',
            type: ''
        }]
    }, {
        name: '',
        description: '',
        type: 'function',
        returnType: '',
        file: globalFile,
        params: [{
            name: '',
            type: ''
        }]
    }, {
        name: '',
        description: '',
        type: 'function',
        returnType: '',
        file: globalFile,
        params: [{
            name: '',
            type: ''
        }]
    }, {
        name: '',
        description: '',
        type: 'function',
        returnType: '',
        file: globalFile,
        params: [{
            name: '',
            type: ''
        }]
    },
];
// , {
//     name: '',
//     description: '',
//     type: 'function',
//     returnType: '',
//     file: globalFile,
//     params: [{
//         name: '',
//         type: ''
//     }]
// }

export default [...mathFunctions, ...runtimeFunctions];