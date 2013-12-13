/*
 * Copyright 2013 the original author or authors
 * @license MIT, see LICENSE.txt for details
 *
 * @author Scott Andrews
 */

(function (define) {
    'use strict';

    define(function () {

        // EMCAScript requires at least between 1 and 21 digits of precision.
        // We drop the limit to 15 digits to avoid floating point rounding issues.
        var MAX_PRECISION = 15,
            MIN_PRECISION = 1;

        function Operations() {
            var ops = {},
                listeners = [];

            this.register = function register(name, func) {
                if (ops.hasOwnProperty(name)) {
                    throw new Error('Operation [' + name + '] is already registered');
                }
                ops[name] = func;
                listeners.forEach(function (listener) {
                    listener(name, func);
                });
            };

            this.onRegister = function onRegister(listener) {
                listeners.push(listener);
            };

            this.getOperations = function getOperations() {
                // TODO clone to protect from side effects
                return ops;
            };
        }

        function Measure(value, unit, precision) {
            if (value instanceof Measure) {
                return value;
            }
            if (!(this instanceof Measure)) {
                return new Measure(value, unit, precision);
            }

            if (typeof precision !== 'number') {
                // TODO should we infer precision from value
                precision = Number(precision).valueOf();
            }
            if (isNaN(precision)) {
                precision = MAX_PRECISION;
            }

            if (typeof value !== 'number') {
                value = Number(value).valueOf();
            }
            if (isNaN(value)) {
                // TODO use non-coerced value in error message
                throw new Error('A number is required, found [' + value + ']');
            }

            unit = unit || Unit._reserved.nonUnited;
            precision = Math.max(Math.min(precision, MAX_PRECISION), MIN_PRECISION);

            // TODO there's probably a more efficient way to drop precision
            this.val = Number(value.toPrecision(precision));
            this.raw = value;
            this.unit = unit;
            this.precision = precision;
        }

        Measure.prototype.as = function as(unit) {
            if (!(unit instanceof Unit)) {
                // lookup unit
                unit = Unit[this.unit.type][unit];
                if (!unit) {
                    throw new Error('Unable to find unit [' + arguments[0] + ']');
                }
            }
            if (!this.unit.isComparable(unit)) {
                throw new Error('Unit ' + this.unit + ' is not comparable to ' + unit);
            }
            return new Measure(this.raw * this.unit.scale / unit.scale, unit, this.precision);
        };

        function Unit() { throw new Error('Unit is not constructable'); }
        Object.defineProperty(Unit, 'prototype', { value: Unit.prototype });
        Unit.register = function register(type, name, abbr, scale) {
            /*jslint evil: true */
            var validNameRE = /^[_a-zA-Z]\w*$/;
            if (!validNameRE.test(type)) {
                throw new Error('Type must be a camel case identifier [' + type + ']');
            }
            if (!validNameRE.test(name)) {
                throw new Error('Name must be a camel case identifier [' + name + ']');
            }

            if (!Unit[type]) {
                // define unit type
                Object.defineProperty(Unit, type, { enumerable: true, value: eval('(function ' + type + '() { throw new Error(\'' + type + ' is not constructable\') })') });
                Unit[type].prototype = Object.create(Unit.prototype);
                Object.defineProperties(Unit[type].prototype, {
                    isComparable: { value: function (other) { return other instanceof Unit[type]; } }
                });
                Object.defineProperty(Unit[type], 'property', { value: Unit[type].prototype });

                if (!(type in Measure) && type.slice(0,1) !== '_') {
                    Object.defineProperty(Measure, type, { value: Unit[type] });
                }
            }
            if (Unit[type][name]) {
                throw new Error('Unit already exists [' + type + '][' + name + ']');
            }

            // define unit
            Object.defineProperty(Unit[type], name, { enumerable: true, value: Object.create(Unit[type].prototype) });
            Object.defineProperties(Unit[type][name], {
                name: { enumerable: true, value: name },
                type: { enumerable: true, value: type },
                abbr: { enumerable: true, value: abbr },
                scale: { enumerable: true, value: scale },
                toString: { value: function () { return name; } }
            });
        };


        var operations = new Operations();

        // automatically add operation to Measure instances
        operations.onRegister(function (name, operation) {
            Measure.prototype[name] = function (measure) {
                if (!(measure instanceof Measure)) {
                    // always use same argument signature as Measure
                    measure = Object.create(Measure.prototype);
                    Measure.apply(measure, arguments);
                }
                if (!this.unit.isComparable(measure.unit)) {
                    throw new Error('Unit ' + this.unit + ' is not comparable to ' + measure.unit);
                }
                return new Measure(
                    operation(this.raw * this.unit.scale, measure.raw * measure.unit.scale) / this.unit.scale,
                    this.unit,
                    Math.min(this.precision, measure.precision)
                );
            };
        });

        // define basic units
        Unit.register('_reserved', 'nonUnited', '', 1);
        Unit.register('amount', 'count', '', 1);
        Unit.register('amount', 'mole', 'mol', 1);
        Unit.register('distance', 'astronomicalUnit', 'au', 149597870700);
        Unit.register('distance', 'kilometer',        'km',         1000      );
        Unit.register('distance', 'meter',            'm',             1      );
        Unit.register('distance', 'millimeter',       'mm',            0.001  );
        Unit.register('distance', 'mile',             'mi',         1609.344  );
        Unit.register('distance', 'yard',             'yd',            0.9144 );
        Unit.register('distance', 'foot',             'ft',            0.30480);
        Unit.register('distance', 'inch',             'in',            0.0254 );
        Unit.register('time', 'day',    'd',  86400);
        Unit.register('time', 'hour',   'hr',  3600);
        Unit.register('time', 'minute', 'm',     60);
        Unit.register('time', 'second', 's',      1);

        // register basic math operations
        operations.register('add',      function (a, b) { return a + b; });
        operations.register('subtract', function (a, b) { return a - b; });
        operations.register('multiply', function (a, b) { return a * b; });
        operations.register('divide',   function (a, b) { return a / b; });

        Object.defineProperties(Measure, {
            Measure: { enumerable: true, value: Measure },
            Unit: { enumerable: true, value: Unit },
            operations: { enumerable: true, value: operations }
        });

        return Measure;

    });

}(
    typeof define === 'function' && define.amd ? define : function (factory) { module.exports = factory(require); }
    // Boilerplate for AMD and Node
));
