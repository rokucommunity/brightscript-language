import * as path from 'path';
import * as sinonImport from 'sinon';

import { BRSProgram } from './BRSProgram';
import { BRSFile } from './BRSFile';
import { expect } from 'chai';

describe('BRSFile', () => {

    let sinon = sinonImport.createSandbox();
    beforeEach(() => {
    });
    afterEach(() => {
        sinon.restore();
    });

    describe('parse', () => {
        it('finds line and column numbers for functions', async () => {
            let file = new BRSFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function DoA()
                    print "A"
                end function

                 function DoB()
                     print "B"
                 end function
            `);
            expect(file.callables[0].name).to.equal('DoA');
            expect(file.callables[0].lineIndex).to.equal(1);
            expect(file.callables[0].columnIndexBegin).to.equal(25)
            expect(file.callables[0].columnIndexEnd).to.equal(28)

            expect(file.callables[1].name).to.equal('DoB');
            expect(file.callables[1].lineIndex).to.equal(5);
            expect(file.callables[1].columnIndexBegin).to.equal(26)
            expect(file.callables[1].columnIndexEnd).to.equal(29)
        });

        it('finds and registers duplicate callables', async () => {
            let file = new BRSFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function DoA()
                    print "A"
                end function

                 function DoA()
                     print "A"
                 end function
            `);
            expect(file.callables.length).to.equal(2);
            expect(file.callables[0].name).to.equal('DoA');
            expect(file.callables[0].lineIndex).to.equal(1);

            expect(file.callables[1].name).to.equal('DoA');
            expect(file.callables[1].lineIndex).to.equal(5);
        });

        it('finds function call line and column numbers', async () => {
            let file = new BRSFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function DoA()
                    DoB()
                end function
                function DoB()
                     DoC()
                end function
            `);
            expect(file.expressionCalls.length).to.equal(2);

            expect(file.expressionCalls[0].lineIndex).to.equal(2);
            expect(file.expressionCalls[0].columnIndexBegin).to.equal(20);
            expect(file.expressionCalls[0].columnIndexEnd).to.equal(23);

            expect(file.expressionCalls[1].lineIndex).to.equal(5);
            expect(file.expressionCalls[1].columnIndexBegin).to.equal(21);
            expect(file.expressionCalls[1].columnIndexEnd).to.equal(24);
        });

        it.only('sanitizes brs errors', async () => {
            let file = new BRSFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
            '
            ' Shows the user a message and waits until they click ok
            Sub b_alert(message as string) 
                print "Alerting: '" + message + "'"
                port = CreateObject("roMessagePort")
                dialog = CreateObject("roMessageDialog")
                dialog.SetMessagePort(port) 
                'dialog.SetTitle(messageTitle)
                dialog.SetText(message)
             
                dialog.AddButton(1, "Ok")
                dialog.EnableBackButton(false)
                dialog.Show()
                While True
                    dlgMsg = wait(0, dialog.GetMessagePort())
                    If type(dlgMsg) = "roMessageDialogEvent"
                        if dlgMsg.isButtonPressed()
                            exit while
                        end If
                    end If
                end While
            end Sub
            
            function b_ceil(val as integer)
                ceiling = val
                if Int(val) = val 
                    ceiling = val
                else 
                    ceiling = Int(val) + 1
                end if
                return ceiling
            end function
            
            
            '
            ' Prompts the user to choose from the specified options. 
            ' @param {string} message - the message 
            ' @param {int} selectedItemIndex - the index of the item that should be selected by default
            ' @param ... pass in a string for each option
            ' @return {int} - the zero based index of the item selected, where 0 is the first option
            function b_choose(message, selectedItemIndex, a=invalid,b=invalid,c=invalid,d=invalid,e=invalid,f=invalid,g=invalid,h=invalid) as integer
                print b_concat("Making user choose: '", message)
                port = CreateObject("roMessagePort")
                dialog = CreateObject("roMessageDialog")
                dialog.SetMessagePort(port) 
                dialog.EnableBackButton(true)
                'dialog.SetTitle(messageTitle)
                dialog.SetText(message)
                options = [a,b,c,d,e,f,g,h]
                i = 0
                for each option in options
                    if option = invalid
                        exit for
                    end if
                    dialog.AddButton(i, option)
                    i = i + 1
                end for
                dialog.SetFocusedMenuItem(selectedItemIndex)
                dialog.Show()
                While True
                    dlgMsg = wait(0, dialog.GetMessagePort())
                    If type(dlgMsg) = "roMessageDialogEvent"
                        if dlgMsg.isButtonPressed()
                            selectedIndex = dlgMsg.GetIndex()
                            return selectedIndex
                        Else If dlgMsg.isScreenClosed()
                            exit while
                        end If
                    end If
                end While
                'default to return false
                print "User chose cancel or back" 
                Return -1 
            end function
            
            '
            ' Concatenates the params together, while calling toString on each one of them so that it won't throw type errors like
            ' when using the + operator. 
            ' @param {...dynamic} - pass in up to 12 parameters to be concatenated together
            '
            function b_concat(a=invalid,b=invalid,c=invalid,d=invalid,e=invalid,f=invalid,g=invalid,h=invalid,i=invalid,j=invalid,k=invalid,l=invalid)
                result = ""
                if a <> invalid
                    result = result + b_toString(a)
                end if
                if b <> invalid
                    result = result + b_toString(b)
                end if
                if c <> invalid
                    result = result + b_toString(c)
                end if
                if d <> invalid
                    result = result + b_toString(d)
                end if
                if e <> invalid
                    result = result + b_toString(e)
                end if
                if f <> invalid
                    result = result + b_toString(f)
                end if
                if g <> invalid
                    result = result + b_toString(g)
                end if
                if h <> invalid
                    result = result + b_toString(h)
                end if
                if i <> invalid
                    result = result + b_toString(i)
                end if
                if j <> invalid
                    result = result + b_toString(j)
                end if
                if k <> invalid
                    result = result + b_toString(k)
                end if
                return result
            end function
            
            '
            ' Deletes a registry setting from the registry
            ' @param string name - the name of the registry key
            ' @param {string} [section="Settings"] - the section the value is saved in. If not specified, the default is used
            '
            function b_deleteRegistryValue(name as String, section="Settings") as Void
                sec = CreateObject("roRegistrySection", section)
                sec.Delete(name)
                sec.Flush()
            end function
            
            '**
            ' Turns the value into a url-safe string (converting invalid characters to their safe representations
            ' @param {string} value - the value to be escaped
            ' @return {string} - the value in url escaped form
            '*
            function b_escapeUrl(value) as String
                value = b_toString(value)
                o = CreateObject("roUrlTransfer")
                return o.Escape(value)
            end function
            
            '
            ' Retrieves the registry value in the provided section and at the specified key
            ' @param string name - the name of the variable to be saved in the registry
            ' @param {string} [section="Settings"] - the section to save the value into. If not specified, the default is used
            '
            function b_getRegistryValue(name as String, section="Settings") as dynamic
                sec = CreateObject("roRegistrySection", section)
                 if sec.Exists(name)  
                     return sec.Read(name)
                 endif
                 return invalid
            end function
            
            
            '
            ' Function form of the ternary operator. If param 1 is true, return param 2. otherwise return param 3
            ' @param {boolean} condition - the boolean condition
            ' @param {dynamic} trueValue - the value to be returned if condition is true
            ' @param {dynamic} falseValue - the value to be returned if the condition is not true
            ' @return {dynamic} param2 or param 3, depending on the condition
            '
            function b_iff(condition, trueValue, falseValue)
                if condition = true
                    return trueValue
                else
                    return falseValue
                end if
            end function
            
            
            function b_isXmlElement(value as Dynamic) as Boolean
                Return b_isValid(value) And GetInterface(value, "ifXMLElement") <> invalid
            end function
            
            function b_isfunction(value as Dynamic) as Boolean
                Return b_isValid(value) And GetInterface(value, "iffunction") <> invalid
            end function
            
            function b_isBoolean(value as Dynamic) as Boolean
                Return b_isValid(value) And GetInterface(value, "ifBoolean") <> invalid
            end function
            
            function b_isInteger(value as Dynamic) as Boolean
                Return b_isValid(value) And GetInterface(value, "ifInt") <> invalid And (Type(value) = "roInt" Or Type(value) = "roInteger" Or Type(value) = "Integer")
            end function
            
            function b_isFloat(value as Dynamic) as Boolean
                Return b_isValid(value) And (GetInterface(value, "ifFloat") <> invalid Or (Type(value) = "roFloat" Or Type(value) = "Float"))
            end function
            
            function b_isDouble(value as Dynamic) as Boolean
                Return b_isValid(value) And (GetInterface(value, "ifDouble") <> invalid Or (Type(value) = "roDouble" Or Type(value) = "roIntrinsicDouble" Or Type(value) = "Double"))
            end function
            
            function b_isList(value as Dynamic) as Boolean
                Return b_isValid(value) And GetInterface(value, "ifList") <> invalid
            end function
            
            function b_isArray(value as Dynamic) as Boolean
                Return b_isValid(value) And GetInterface(value, "ifArray") <> invalid
            end function
            
            function b_isAssociativeArray(value as Dynamic) as Boolean
                Return b_isValid(value) And GetInterface(value, "ifAssociativeArray") <> invalid
            end function
            
            function b_isString(value as Dynamic) as Boolean
                Return b_isValid(value) And GetInterface(value, "ifString") <> invalid
            end function
            
            function b_isDateTime(value as Dynamic) as Boolean
                Return b_isValid(value) And (GetInterface(value, "ifDateTime") <> invalid Or Type(value) = "roDateTime")
            end function
            
            function b_isValid(value as Dynamic) as Boolean
                Return Type(value) <> "<uninitialized>" And value <> invalid
            end function
            
            function b_isInvalid(value as Dynamic) as Boolean
                Return not b_isValid(value)
            end function
            
            '
            ' Join an array of items into a string separated by the separator
            ' @return string
            '
            function b_join(arr, separator)
                result = ""
                sep = ""
                for each item in arr
                    result = result +  sep + b_toString(item)
                    sep = separator
                end for
                return result
            end function
            
            
            function b_jsonStringify(obj as dynamic)
                return SimpleJSONBuilder(obj)
            end function
            
            Function SimpleJSONBuilder( jsonArray As Object ) As String
                Return SimpleJSONAssociativeArray( jsonArray )
            End Function
            
            
            Function SimpleJSONAssociativeArray( jsonArray As Object ) As String
                jsonString = "{"
                
                For Each key in jsonArray
                    jsonString = jsonString + Chr(34) + key + Chr(34) + ":"
                    value = jsonArray[ key ]
                    if b_isInvalid(value) then
                        jsonString = jsonString + "null"
                    else if b_isString(value) then
                        jsonString = jsonString + Chr(34) + value + Chr(34)
                    else if b_isInteger(value) or b_isFloat(value) then
                        jsonString = jsonString + value.ToStr()
                    else if b_isBoolean(value) then
                        jsonString = jsonString + IIf( value, "true", "false" )
                    else if b_isArray(value) then
                        jsonString = jsonString + SimpleJSONArray( value )
                    else if b_isAssociativeArray(value) then
                        jsonString = jsonString + SimpleJSONBuilder( value )
                    end if
                    jsonString = jsonString + ","
                Next
                If Right( jsonString, 1 ) = "," Then
                    jsonString = Left( jsonString, Len( jsonString ) - 1 )
                End If
                
                jsonString = jsonString + "}"
                Return jsonString
            End Function
            
            
            Function SimpleJSONArray( jsonArray As Object ) As String
                jsonString = "["
                
                For Each value in jsonArray
                    If Type( value ) = "roString" Then
                        jsonString = jsonString + Chr(34) + value + Chr(34)
                    Else If Type( value ) = "roInt" Or Type( value ) = "roFloat" Then
                        jsonString = jsonString + value.ToStr()
                    Else If Type( value ) = "roBoolean" Then
                        jsonString = jsonString + IIf( value, "true", "false" )
                    Else If Type( value ) = "roArray" Then
                        jsonString = jsonString + SimpleJSONArray( value )
                    Else If Type( value ) = "roAssociativeArray" Then
                        jsonString = jsonString + SimpleJSONAssociativeArray( value )
                    End If
                    jsonString = jsonString + ","
                Next
                If Right( jsonString, 1 ) = "," Then
                    jsonString = Left( jsonString, Len( jsonString ) - 1 )
                End If
                
                jsonString = jsonString + "]"
                Return jsonString
            End Function
            
            Function IIf( Condition, Result1, Result2 )
                If Condition Then
                    Return Result1
                Else
                    Return Result2
                End If
            End Function
            
            '
            ' Converts the value into an integer. This is helpful for passing in something that you are not sure of the type, like
            ' a string or an integer, to make sure that it is an integer for sure
            ' @param {dynamic} value - the value to be converted into an integer
            ' @return {dynamic} - if the value is able to be converted to integer, the value in integer form is returned. If there
            '                     was a problem with the conversion, invalid is returned instead
            function b_parseInt(value as dynamic) as dynamic
                return Strtoi(b_toString(value))
            end function
            
            
            '
            ' This is a function that makes it easier to print messages with indentations
            ' @param {string} message - the message to print
            ' @param {integer} changeInDepth - changes the nested level of any messages AFTER this one
            '
            function b_print(message, changeInDepth=invalid)
                m.b_indentationLevel = b_iff(m.b_indentationLevel = invalid, 0, m.b_indentationLevel)
                spaces = ""
                for i = 0 to m.b_indentationLevel step 1
                    spaces = spaces + "    "
                end for
                if b_isValid(message) then
                    'print the message
                    print spaces + b_toString(message)
                end if
                m.b_indentationLevel = m.b_indentationLevel + b_iff(b_isInvalid(changeInDepth), 0, b_parseInt(changeInDepth))
            end function
            
            '
            ' Combination of print and concat, without the b_print's changeInLevel option
            ' 
            function b_printc(a=invalid,b=invalid,c=invalid,d=invalid,e=invalid,f=invalid,g=invalid,h=invalid,i=invalid,j=invalid,k=invalid,l=invalid)
                return b_print(b_concat(a,b,c,d,e,f,g,h,i,j,k,l))
            end function
            
            '
            ' Saves a value to the registry in the 'Settings category
            ' @param string name - the name of the variable to be saved in the registry
            ' @param string value - the value to save into the registry
            ' @param {string} [section="Settings"] - the section to save the value into. If not specified, the default is used
            '
            function b_setRegistryValue(name as string, value as string, section="Settings") as void
                sec = CreateObject("roRegistrySection", section)
                sec.Write(name, value)
                sec.Flush()
            end function
            
            '''
            ' count the number of items in an array or associative array
            '''
            function b_size(collection=invalid)
                count = 0 
                if collection = invalid
                    count = 0
                'if it has a count function, use that
                else if b_isArray(collection)
                    count = collection.Count()
                else
                    'manually determine its size by interating over each item in the list
                    for each item in collection
                        count = count + 1
                    end for
                end if
                return count
            end function
            
            
            '
            ' This provides a way to get a notification every n seconds while still getting remote events
            ' @param {object} obj - the configuration object. The following properties are required, but you can also
            '                       pass in any additional properties, as they will be needed if you need to access out-of-scope values
                                    'from the callbacks. This entire object is passed in to the callbacks
            '                       {
            '                            {integer} durationMilliseconds - the total duration that this loop should run
            '                            {integer} intervalMilliseconds - the number of milliseconds between each time the notify function is called
            '                            {roMessagePort} port - the port to listen for messages on
            '                            {function(obj, message)} messageCallback - a function called everytime a message is raised on the port.
            '                                                                        returning anything other than invalid from this function will
            '                                                                        cause the loop to terminate and return that value
            '                            {function(obj)} intervalCallback - a function called every time the interval happens.  
            '                                                            returning anything other than invalid from this function will
            '                                                            cause the loop to terminate and return that value
                  
            ' @return {object} - returns the result of one of the callbacks, or invalid when finished                       
            '
            function b_timedInterval(obj as dynamic) 
                
                if b_isInvalid(obj.durationMilliseconds) then
                    print "obj.durationMilliseconds is invalid"
                else 
                    print "obj.durationMilliseconds is valid";obj.durationMilliseconds
                end if
                obj.durationMilliseconds = b_iff(b_isInvalid(obj.durationMilliseconds), 10000, obj.durationMilliseconds)
                obj.intervalMilliseconds = b_iff(b_isInvalid(obj.intervalMilliseconds), 1000, obj.intervalMilliseconds)
                obj.port = b_iff(b_isInvalid(obj.port),  CreateObject("roMessagePort"), obj.port)
                
                clock = CreateObject("roTimespan")
                lastCall = clock.TotalMilliseconds() + obj.durationMilliseconds
                
                next_call = clock.TotalMilliseconds() + obj.intervalMilliseconds
                while true
                    msg = wait(250, obj.port) ' wait for a message
                    if b_isValid(msg) then
                        result = obj.messageCallback(obj, msg)
                        if b_isValid(result) then
                            return result
                        end if
                    end if
                    if clock.TotalMilliseconds() > next_call then
                        'if we have exceeded the alotted duration, finish
                        if clock.TotalMilliseconds() >= lastCall then
                            return invalid
                        end if
                        result = obj.intervalCallback(obj)
                         if b_isValid(result) then
                            return result
                        end if
                        next_call = clock.TotalMilliseconds() + obj.intervalMilliseconds
                    end if
                end while
                return invalid
            end function
            
            '**
            ' Converts the item to a string
            ' @param {object} item - the item to be converted to a string
            ' @return {string} - the item in its string representation
            '*
            function b_toString(item) as String
                result = ""
                itemType = type(item)
                
                if item = invalid
                    result = "invalid"
                else if itemType = "String"
                    result = item
                else if itemType = "roString"
                    result = item.GetString()
                else if itemType = "roAssociativeArray" 
                    result = b_jsonStringify(item)
                else if itemType = "Boolean"
                    result = iff(item, "true", "false")
                else if itemType = "Integer" or itemType = "Float" or itemType = "Double"
                    'remove the leading space brightscript puts in for numeric types
                    result = Str(item).trim()
                else if itemType = "Object"
                    result = "[object]"
                else if itemType = "function"
                    result = "[function]"
                else if itemType = "Interface"
                    result = "[interface]"
                else if itemType = "roArray"
                    result = "["
                    sep = ""
                    for each arrItem in item
                        quot = b_iff(type(arrItem) = "String", "'","")
                        result = result + sep + quot + b_toString(arrItem) + quot
                        sep = ","
                    end for
                    result = result + "]"
                else
                    result = Str(item)
                end if
                return result
            end function
            
            function b_urlEncode(str)
                o = CreateObject("roUrlTransfer")
                return o.Escape(str)
            end function
            
            
            
            `);
            expect(file.expressionCalls.length).to.equal(2);
        });
    });

});