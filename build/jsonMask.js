/**
 * json-mask | (c) 2015 Yuriy Nemtsov | https://github.com/nemtsov/json-mask/blob/master/LICENSE
 * @license
 */
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.jsonMask = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var util = require('./util')
var TERMINALS = {',': 1, '/': 2, '(': 3, ')': 4}

module.exports = compile

/**
 *  Compiler
 *
 *  Grammar:
 *     Props ::= Prop | Prop "," Props
 *      Prop ::= Object | Array
 *    Object ::= NAME | NAME "/" Object
 *     Array ::= NAME "(" Props ")"
 *      NAME ::= ? all visible characters ?
 *
 *  Examples:
 *    a
 *    a,d,g
 *    a/b/c
 *    a(b)
 *    ob,a(k,z(f,g/d)),d
 */

function compile (text) {
  if (!text) return null
  return parse(scan(text))
}

function scan (text) {
  var i = 0
  var len = text.length
  var tokens = []
  var name = ''
  var ch

  function maybePushName () {
    if (!name) return
    tokens.push({tag: '_n', value: name})
    name = ''
  }

  for (; i < len; i++) {
    ch = text.charAt(i)
    if (TERMINALS[ch]) {
      maybePushName()
      tokens.push({tag: ch})
    } else {
      name += ch
    }
  }
  maybePushName()

  return tokens
}

function parse (tokens) {
  return _buildTree(tokens, {}, [])
}

function _buildTree (tokens, parent, stack) {
  var props = {}
  var token
  var peek

  while ((token = tokens.shift())) {
    if (token.tag === '_n') {
      token.type = 'object'
      token.properties = _buildTree(tokens, token, stack)
      // exit if in object stack
      peek = stack[stack.length - 1]
      if (peek && (peek.tag === '/')) {
        stack.pop()
        _addToken(token, props)
        return props
      }
    } else if (token.tag === ',') {
      return props
    } else if (token.tag === '(') {
      stack.push(token)
      parent.type = 'array'
      continue
    } else if (token.tag === ')') {
      stack.pop(token)
      return props
    } else if (token.tag === '/') {
      stack.push(token)
      continue
    }
    _addToken(token, props)
  }

  return props
}

function _addToken (token, props) {
  props[token.value] = {type: token.type}
  if (!util.isEmpty(token.properties)) {
    props[token.value].properties = token.properties
  }
}

},{"./util":4}],2:[function(require,module,exports){
var util = require('./util')

module.exports = filter

function filter (obj, compiledMask) {
  return util.isArray(obj)
    ? _arrayProperties(obj, compiledMask)
    : _properties(obj, compiledMask)
}

// wrap array & mask in a temp object;
// extract results from temp at the end
function _arrayProperties (arr, mask) {
  var obj = _properties({_: arr}, {_: {
    type: 'array',
    properties: mask
  }})
  return obj && obj._
}

function _properties (obj, mask) {
  var maskedObj, key, value, ret, retKey, typeFunc
  if (!obj || !mask) return obj

  if (util.isArray(obj)) maskedObj = []
  else if (util.isObject(obj)) maskedObj = {}

  for (key in mask) {
    if (!util.has(mask, key)) continue
    value = mask[key]
    ret = undefined
    typeFunc = (value.type === 'object') ? _object : _array
    if (key === '*') {
      ret = _forAll(obj, value.properties, typeFunc)
      for (retKey in ret) {
        if (!util.has(ret, retKey)) continue
        maskedObj[retKey] = ret[retKey]
      }
    } else {
      ret = typeFunc(obj, key, value.properties)
      if (typeof ret !== 'undefined') maskedObj[key] = ret
    }
  }
  return maskedObj
}

function _forAll (obj, mask, fn) {
  var ret = {}
  var key
  var value
  for (key in obj) {
    if (!util.has(obj, key)) continue
    value = fn(obj, key, mask)
    if (typeof value !== 'undefined') ret[key] = value
  }
  return ret
}

function _object (obj, key, mask) {
  var value = obj[key]
  if (util.isArray(value)) return _array(obj, key, mask)
  return mask ? _properties(value, mask) : value
}

function _array (object, key, mask) {
  var ret = []
  var arr = object[key]
  var obj
  var maskedObj
  var i
  var l
  if (!util.isArray(arr)) return _properties(arr, mask)
  if (util.isEmpty(arr)) return arr
  for (i = 0, l = arr.length; i < l; i++) {
    obj = arr[i]
    maskedObj = _properties(obj, mask)
    if (typeof maskedObj !== 'undefined') ret.push(maskedObj)
  }
  return ret.length ? ret : undefined
}

},{"./util":4}],3:[function(require,module,exports){
var compile = require('./compiler')
var filter = require('./filter')

function mask (obj, mask) {
  return filter(obj, compile(mask)) || null
}

mask.compile = compile
mask.filter = filter

module.exports = mask

},{"./compiler":1,"./filter":2}],4:[function(require,module,exports){
var ObjProto = Object.prototype

exports.isEmpty = isEmpty
exports.isArray = Array.isArray || isArray
exports.isObject = isObject
exports.has = has

function isEmpty (obj) {
  if (obj == null) return true
  if (isArray(obj) ||
     (typeof obj === 'string')) return (obj.length === 0)
  for (var key in obj) if (has(obj, key)) return false
  return true
}

function isArray (obj) {
  return ObjProto.toString.call(obj) === '[object Array]'
}

function isObject (obj) {
  return typeof obj === 'function' || typeof obj === 'object' && !!obj
}

function has (obj, key) {
  return ObjProto.hasOwnProperty.call(obj, key)
}

},{}]},{},[3])(3)
});
