(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["calendarUtils"] = factory();
	else
		root["calendarUtils"] = factory();
})(typeof self !== 'undefined' ? self : this, () => {
return /******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	// The require scope
/******/ 	var __webpack_require__ = {};
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DAYS_OF_WEEK: () => (/* binding */ DAYS_OF_WEEK),
/* harmony export */   EventValidationErrorMessage: () => (/* binding */ EventValidationErrorMessage),
/* harmony export */   SECONDS_IN_DAY: () => (/* binding */ SECONDS_IN_DAY),
/* harmony export */   getAllDayWeekEvents: () => (/* binding */ getAllDayWeekEvents),
/* harmony export */   getDifferenceInDaysWithExclusions: () => (/* binding */ getDifferenceInDaysWithExclusions),
/* harmony export */   getEventsInPeriod: () => (/* binding */ getEventsInPeriod),
/* harmony export */   getMonthView: () => (/* binding */ getMonthView),
/* harmony export */   getWeekView: () => (/* binding */ getWeekView),
/* harmony export */   getWeekViewHeader: () => (/* binding */ getWeekViewHeader),
/* harmony export */   validateEvents: () => (/* binding */ validateEvents)
/* harmony export */ });
var DAYS_OF_WEEK;
(function (DAYS_OF_WEEK) {
    DAYS_OF_WEEK[DAYS_OF_WEEK["SUNDAY"] = 0] = "SUNDAY";
    DAYS_OF_WEEK[DAYS_OF_WEEK["MONDAY"] = 1] = "MONDAY";
    DAYS_OF_WEEK[DAYS_OF_WEEK["TUESDAY"] = 2] = "TUESDAY";
    DAYS_OF_WEEK[DAYS_OF_WEEK["WEDNESDAY"] = 3] = "WEDNESDAY";
    DAYS_OF_WEEK[DAYS_OF_WEEK["THURSDAY"] = 4] = "THURSDAY";
    DAYS_OF_WEEK[DAYS_OF_WEEK["FRIDAY"] = 5] = "FRIDAY";
    DAYS_OF_WEEK[DAYS_OF_WEEK["SATURDAY"] = 6] = "SATURDAY";
})(DAYS_OF_WEEK || (DAYS_OF_WEEK = {}));
const DEFAULT_WEEKEND_DAYS = [
    DAYS_OF_WEEK.SUNDAY,
    DAYS_OF_WEEK.SATURDAY,
];
const DAYS_IN_WEEK = 7;
const HOURS_IN_DAY = 24;
const MINUTES_IN_HOUR = 60;
const SECONDS_IN_DAY = 60 * 60 * 24;
function getExcludedSeconds(dateAdapter, { startDate, seconds, excluded, precision, }) {
    if (excluded.length < 1) {
        return 0;
    }
    const { addSeconds, getDay, addDays } = dateAdapter;
    let endDate = addSeconds(startDate, seconds - 1);
    if (precision === 'days') {
        // otherwise when changing to DST hour may shift before the hour of the start date
        const daysDiff = Math.round(seconds / SECONDS_IN_DAY);
        endDate = addSeconds(addDays(startDate, daysDiff), -1);
    }
    const dayStart = getDay(startDate);
    const dayEnd = getDay(endDate);
    let result = 0; // Calculated in seconds
    let current = startDate;
    while (current < endDate) {
        const day = getDay(current);
        if (excluded.some((excludedDay) => excludedDay === day)) {
            result += calculateExcludedSeconds(dateAdapter, {
                dayStart,
                dayEnd,
                day,
                precision,
                startDate,
                endDate,
            });
        }
        current = addDays(current, 1);
    }
    return result;
}
function calculateExcludedSeconds(dateAdapter, { precision, day, dayStart, dayEnd, startDate, endDate, }) {
    const { differenceInSeconds, endOfDay, startOfDay } = dateAdapter;
    if (precision === 'minutes') {
        if (day === dayStart) {
            return differenceInSeconds(endOfDay(startDate), startDate) + 1;
        }
        else if (day === dayEnd) {
            return differenceInSeconds(endDate, startOfDay(endDate)) + 1;
        }
    }
    return SECONDS_IN_DAY;
}
function getWeekViewEventSpan(dateAdapter, { event, offset, startOfWeekDate, excluded, precision, totalDaysInView, }) {
    const { max, differenceInSeconds, addDays, endOfDay, differenceInDays } = dateAdapter;
    let span = SECONDS_IN_DAY;
    const begin = max([event.start, startOfWeekDate]);
    if (event.end) {
        switch (precision) {
            case 'minutes':
                span = differenceInSeconds(event.end, begin);
                break;
            default:
                span =
                    differenceInDays(addDays(endOfDay(event.end), 1), begin) *
                        SECONDS_IN_DAY;
                break;
        }
    }
    const offsetSeconds = offset * SECONDS_IN_DAY;
    const totalLength = offsetSeconds + span;
    // the best way to detect if an event is outside the week-view
    // is to check if the total span beginning (from startOfWeekDay or event start) exceeds the total days in the view
    const secondsInView = totalDaysInView * SECONDS_IN_DAY;
    if (totalLength > secondsInView) {
        span = secondsInView - offsetSeconds;
    }
    span -= getExcludedSeconds(dateAdapter, {
        startDate: begin,
        seconds: span,
        excluded,
        precision,
    });
    return span / SECONDS_IN_DAY;
}
function getWeekViewEventOffset(dateAdapter, { event, startOfWeek: startOfWeekDate, excluded, precision, }) {
    const { differenceInDays, startOfDay, differenceInSeconds } = dateAdapter;
    if (event.start < startOfWeekDate) {
        return 0;
    }
    let offset = 0;
    switch (precision) {
        case 'days':
            offset =
                differenceInDays(startOfDay(event.start), startOfWeekDate) *
                    SECONDS_IN_DAY;
            break;
        case 'minutes':
            offset = differenceInSeconds(event.start, startOfWeekDate);
            break;
    }
    offset -= getExcludedSeconds(dateAdapter, {
        startDate: startOfWeekDate,
        seconds: offset,
        excluded,
        precision,
    });
    return Math.abs(offset / SECONDS_IN_DAY);
}
function isEventIsPeriod(dateAdapter, { event, periodStart, periodEnd }) {
    const { isSameSecond } = dateAdapter;
    const eventStart = event.start;
    const eventEnd = event.end || event.start;
    if (eventStart > periodStart && eventStart < periodEnd) {
        return true;
    }
    if (eventEnd > periodStart && eventEnd < periodEnd) {
        return true;
    }
    if (eventStart < periodStart && eventEnd > periodEnd) {
        return true;
    }
    if (isSameSecond(eventStart, periodStart) ||
        isSameSecond(eventStart, periodEnd)) {
        return true;
    }
    if (isSameSecond(eventEnd, periodStart) ||
        isSameSecond(eventEnd, periodEnd)) {
        return true;
    }
    return false;
}
function getEventsInPeriod(dateAdapter, { events, periodStart, periodEnd }) {
    return events.filter((event) => isEventIsPeriod(dateAdapter, { event, periodStart, periodEnd }));
}
function getWeekDay(dateAdapter, { date, weekendDays = DEFAULT_WEEKEND_DAYS, }) {
    const { startOfDay, isSameDay, getDay } = dateAdapter;
    const today = startOfDay(new Date());
    const day = getDay(date);
    return {
        date,
        day,
        isPast: date < today,
        isToday: isSameDay(date, today),
        isFuture: date > today,
        isWeekend: weekendDays.indexOf(day) > -1,
    };
}
function getWeekViewHeader(dateAdapter, { viewDate, weekStartsOn, excluded = [], weekendDays, viewStart = dateAdapter.startOfWeek(viewDate, { weekStartsOn }), viewEnd = dateAdapter.addDays(viewStart, DAYS_IN_WEEK), }) {
    const { addDays, getDay } = dateAdapter;
    const days = [];
    let date = viewStart;
    while (date < viewEnd) {
        if (!excluded.some((e) => getDay(date) === e)) {
            days.push(getWeekDay(dateAdapter, { date, weekendDays }));
        }
        date = addDays(date, 1);
    }
    return days;
}
function getDifferenceInDaysWithExclusions(dateAdapter, { date1, date2, excluded }) {
    let date = date1;
    let diff = 0;
    while (date < date2) {
        if (excluded.indexOf(dateAdapter.getDay(date)) === -1) {
            diff++;
        }
        date = dateAdapter.addDays(date, 1);
    }
    return diff;
}
function getAllDayWeekEvents(dateAdapter, { events = [], excluded = [], precision = 'days', absolutePositionedEvents = false, viewStart, viewEnd, }) {
    viewStart = dateAdapter.startOfDay(viewStart);
    viewEnd = dateAdapter.endOfDay(viewEnd);
    const { differenceInSeconds, differenceInDays } = dateAdapter;
    const maxRange = getDifferenceInDaysWithExclusions(dateAdapter, {
        date1: viewStart,
        date2: viewEnd,
        excluded,
    });
    const totalDaysInView = differenceInDays(viewEnd, viewStart) + 1;
    const eventsMapped = events
        .filter((event) => event.allDay)
        .map((event) => {
        const offset = getWeekViewEventOffset(dateAdapter, {
            event,
            startOfWeek: viewStart,
            excluded,
            precision,
        });
        const span = getWeekViewEventSpan(dateAdapter, {
            event,
            offset,
            startOfWeekDate: viewStart,
            excluded,
            precision,
            totalDaysInView,
        });
        return { event, offset, span };
    })
        .filter((e) => e.offset < maxRange)
        .filter((e) => e.span > 0)
        .map((entry) => ({
        event: entry.event,
        offset: entry.offset,
        span: entry.span,
        startsBeforeWeek: entry.event.start < viewStart,
        endsAfterWeek: (entry.event.end || entry.event.start) > viewEnd,
    }))
        .sort((itemA, itemB) => {
        const startSecondsDiff = differenceInSeconds(itemA.event.start, itemB.event.start);
        if (startSecondsDiff === 0) {
            return differenceInSeconds(itemB.event.end || itemB.event.start, itemA.event.end || itemA.event.start);
        }
        return startSecondsDiff;
    });
    const allDayEventRows = [];
    const allocatedEvents = [];
    eventsMapped.forEach((event, index) => {
        if (allocatedEvents.indexOf(event) === -1) {
            allocatedEvents.push(event);
            let rowSpan = event.span + event.offset;
            const otherRowEvents = eventsMapped
                .slice(index + 1)
                .filter((nextEvent) => {
                if (nextEvent.offset >= rowSpan &&
                    rowSpan + nextEvent.span <= totalDaysInView &&
                    allocatedEvents.indexOf(nextEvent) === -1) {
                    const nextEventOffset = nextEvent.offset - rowSpan;
                    if (!absolutePositionedEvents) {
                        nextEvent.offset = nextEventOffset;
                    }
                    rowSpan += nextEvent.span + nextEventOffset;
                    allocatedEvents.push(nextEvent);
                    return true;
                }
            });
            const weekEvents = [event, ...otherRowEvents];
            const id = weekEvents
                .filter((weekEvent) => weekEvent.event.id)
                .map((weekEvent) => weekEvent.event.id)
                .join('-');
            allDayEventRows.push(Object.assign({ row: weekEvents }, (id ? { id } : {})));
        }
    });
    return allDayEventRows;
}
function getWeekViewHourGrid(dateAdapter, { events, viewDate, hourSegments, hourDuration, dayStart, dayEnd, weekStartsOn, excluded, weekendDays, segmentHeight, viewStart, viewEnd, minimumEventHeight, }) {
    const dayViewHourGrid = getDayViewHourGrid(dateAdapter, {
        viewDate,
        hourSegments,
        hourDuration,
        dayStart,
        dayEnd,
    });
    const weekDays = getWeekViewHeader(dateAdapter, {
        viewDate,
        weekStartsOn,
        excluded,
        weekendDays,
        viewStart,
        viewEnd,
    });
    const { setHours, setMinutes, getHours, getMinutes } = dateAdapter;
    return weekDays.map((day) => {
        const dayView = getDayView(dateAdapter, {
            events,
            viewDate: day.date,
            hourSegments,
            dayStart,
            dayEnd,
            segmentHeight,
            eventWidth: 1,
            hourDuration,
            minimumEventHeight,
        });
        const hours = dayViewHourGrid.map((hour) => {
            const segments = hour.segments.map((segment) => {
                const date = setMinutes(setHours(day.date, getHours(segment.date)), getMinutes(segment.date));
                return Object.assign(Object.assign({}, segment), { date });
            });
            return Object.assign(Object.assign({}, hour), { segments });
        });
        function getColumnCount(allEvents, prevOverlappingEvents) {
            const columnCount = Math.max(...prevOverlappingEvents.map((iEvent) => iEvent.left + 1));
            const nextOverlappingEvents = allEvents
                .filter((iEvent) => iEvent.left >= columnCount)
                .filter((iEvent) => {
                return (getOverLappingWeekViewEvents(prevOverlappingEvents, iEvent.top, iEvent.top + iEvent.height).length > 0);
            });
            if (nextOverlappingEvents.length > 0) {
                return getColumnCount(allEvents, nextOverlappingEvents);
            }
            else {
                return columnCount;
            }
        }
        const mappedEvents = dayView.events.map((event) => {
            const columnCount = getColumnCount(dayView.events, getOverLappingWeekViewEvents(dayView.events, event.top, event.top + event.height));
            const width = 100 / columnCount;
            return Object.assign(Object.assign({}, event), { left: event.left * width, width });
        });
        return {
            hours,
            date: day.date,
            events: mappedEvents.map((event) => {
                const overLappingEvents = getOverLappingWeekViewEvents(mappedEvents.filter((otherEvent) => otherEvent.left > event.left), event.top, event.top + event.height);
                if (overLappingEvents.length > 0) {
                    return Object.assign(Object.assign({}, event), { width: Math.min(...overLappingEvents.map((otherEvent) => otherEvent.left)) - event.left });
                }
                return event;
            }),
        };
    });
}
function getWeekView(dateAdapter, { events = [], viewDate, weekStartsOn, excluded = [], precision = 'days', absolutePositionedEvents = false, hourSegments, hourDuration, dayStart, dayEnd, weekendDays, segmentHeight, minimumEventHeight, viewStart = dateAdapter.startOfWeek(viewDate, { weekStartsOn }), viewEnd = dateAdapter.endOfWeek(viewDate, { weekStartsOn }), }) {
    if (!events) {
        events = [];
    }
    const { startOfDay, endOfDay } = dateAdapter;
    viewStart = startOfDay(viewStart);
    viewEnd = endOfDay(viewEnd);
    const eventsInPeriod = getEventsInPeriod(dateAdapter, {
        events,
        periodStart: viewStart,
        periodEnd: viewEnd,
    });
    const header = getWeekViewHeader(dateAdapter, {
        viewDate,
        weekStartsOn,
        excluded,
        weekendDays,
        viewStart,
        viewEnd,
    });
    return {
        allDayEventRows: getAllDayWeekEvents(dateAdapter, {
            events: eventsInPeriod,
            excluded,
            precision,
            absolutePositionedEvents,
            viewStart,
            viewEnd,
        }),
        period: {
            events: eventsInPeriod,
            start: header[0].date,
            end: endOfDay(header[header.length - 1].date),
        },
        hourColumns: getWeekViewHourGrid(dateAdapter, {
            events,
            viewDate,
            hourSegments,
            hourDuration,
            dayStart,
            dayEnd,
            weekStartsOn,
            excluded,
            weekendDays,
            segmentHeight,
            viewStart,
            viewEnd,
            minimumEventHeight,
        }),
    };
}
function getMonthView(dateAdapter, { events = [], viewDate, weekStartsOn, excluded = [], viewStart = dateAdapter.startOfMonth(viewDate), viewEnd = dateAdapter.endOfMonth(viewDate), weekendDays, }) {
    if (!events) {
        events = [];
    }
    const { startOfWeek, endOfWeek, differenceInDays, startOfDay, addHours, endOfDay, isSameMonth, getDay, } = dateAdapter;
    const start = startOfWeek(viewStart, { weekStartsOn });
    const end = endOfWeek(viewEnd, { weekStartsOn });
    const eventsInMonth = getEventsInPeriod(dateAdapter, {
        events,
        periodStart: start,
        periodEnd: end,
    });
    const initialViewDays = [];
    let previousDate;
    for (let i = 0; i < differenceInDays(end, start) + 1; i++) {
        // hacky fix for https://github.com/mattlewis92/angular-calendar/issues/173
        let date;
        if (previousDate) {
            date = startOfDay(addHours(previousDate, HOURS_IN_DAY));
            if (previousDate.getTime() === date.getTime()) {
                // DST change, so need to add 25 hours
                /* istanbul ignore next */
                date = startOfDay(addHours(previousDate, HOURS_IN_DAY + 1));
            }
            previousDate = date;
        }
        else {
            date = previousDate = start;
        }
        if (!excluded.some((e) => getDay(date) === e)) {
            const day = getWeekDay(dateAdapter, {
                date,
                weekendDays,
            });
            const eventsInPeriod = getEventsInPeriod(dateAdapter, {
                events: eventsInMonth,
                periodStart: startOfDay(date),
                periodEnd: endOfDay(date),
            });
            day.inMonth = isSameMonth(date, viewDate);
            day.events = eventsInPeriod;
            day.badgeTotal = eventsInPeriod.length;
            initialViewDays.push(day);
        }
    }
    let days = [];
    const totalDaysVisibleInWeek = DAYS_IN_WEEK - excluded.length;
    if (totalDaysVisibleInWeek < DAYS_IN_WEEK) {
        for (let i = 0; i < initialViewDays.length; i += totalDaysVisibleInWeek) {
            const row = initialViewDays.slice(i, i + totalDaysVisibleInWeek);
            const isRowInMonth = row.some((day) => viewStart <= day.date && day.date < viewEnd);
            if (isRowInMonth) {
                days = [...days, ...row];
            }
        }
    }
    else {
        days = initialViewDays;
    }
    const rows = Math.floor(days.length / totalDaysVisibleInWeek);
    const rowOffsets = [];
    for (let i = 0; i < rows; i++) {
        rowOffsets.push(i * totalDaysVisibleInWeek);
    }
    return {
        rowOffsets,
        totalDaysVisibleInWeek,
        days,
        period: {
            start: days[0].date,
            end: endOfDay(days[days.length - 1].date),
            events: eventsInMonth,
        },
    };
}
function getOverLappingWeekViewEvents(events, top, bottom) {
    return events.filter((previousEvent) => {
        const previousEventTop = previousEvent.top;
        const previousEventBottom = previousEvent.top + previousEvent.height;
        if (top < previousEventBottom && previousEventBottom < bottom) {
            return true;
        }
        else if (top < previousEventTop && previousEventTop < bottom) {
            return true;
        }
        else if (previousEventTop <= top && bottom <= previousEventBottom) {
            return true;
        }
        return false;
    });
}
function getDayView(dateAdapter, { events, viewDate, hourSegments, dayStart, dayEnd, eventWidth, segmentHeight, hourDuration, minimumEventHeight, }) {
    const { setMinutes, setHours, startOfDay, startOfMinute, endOfDay, differenceInMinutes, } = dateAdapter;
    const startOfView = setMinutes(setHours(startOfDay(viewDate), sanitiseHours(dayStart.hour)), sanitiseMinutes(dayStart.minute));
    const endOfView = setMinutes(setHours(startOfMinute(endOfDay(viewDate)), sanitiseHours(dayEnd.hour)), sanitiseMinutes(dayEnd.minute));
    endOfView.setSeconds(59, 999);
    const previousDayEvents = [];
    const eventsInPeriod = getEventsInPeriod(dateAdapter, {
        events: events.filter((event) => !event.allDay),
        periodStart: startOfView,
        periodEnd: endOfView,
    });
    const dayViewEvents = eventsInPeriod
        .sort((eventA, eventB) => {
        return eventA.start.valueOf() - eventB.start.valueOf();
    })
        .map((event) => {
        const eventStart = event.start;
        const eventEnd = event.end || eventStart;
        const startsBeforeDay = eventStart < startOfView;
        const endsAfterDay = eventEnd > endOfView;
        const hourHeightModifier = (hourSegments * segmentHeight) / (hourDuration || MINUTES_IN_HOUR);
        let top = 0;
        if (eventStart > startOfView) {
            // adjust the difference in minutes if the user's offset is different between the start of the day and the event (e.g. when going to or from DST)
            const eventOffset = dateAdapter.getTimezoneOffset(eventStart);
            const startOffset = dateAdapter.getTimezoneOffset(startOfView);
            const diff = startOffset - eventOffset;
            top += differenceInMinutes(eventStart, startOfView) + diff;
        }
        top *= hourHeightModifier;
        top = Math.floor(top);
        const startDate = startsBeforeDay ? startOfView : eventStart;
        const endDate = endsAfterDay ? endOfView : eventEnd;
        const timezoneOffset = dateAdapter.getTimezoneOffset(startDate) -
            dateAdapter.getTimezoneOffset(endDate);
        let height = differenceInMinutes(endDate, startDate) + timezoneOffset;
        if (!event.end) {
            height = segmentHeight;
        }
        else {
            height *= hourHeightModifier;
        }
        if (minimumEventHeight && height < minimumEventHeight) {
            height = minimumEventHeight;
        }
        height = Math.floor(height);
        const bottom = top + height;
        const overlappingPreviousEvents = getOverLappingWeekViewEvents(previousDayEvents, top, bottom);
        let left = 0;
        while (overlappingPreviousEvents.some((previousEvent) => previousEvent.left === left)) {
            left += eventWidth;
        }
        const dayEvent = {
            event,
            height,
            width: eventWidth,
            top,
            left,
            startsBeforeDay,
            endsAfterDay,
        };
        previousDayEvents.push(dayEvent);
        return dayEvent;
    });
    const width = Math.max(...dayViewEvents.map((event) => event.left + event.width));
    const allDayEvents = getEventsInPeriod(dateAdapter, {
        events: events.filter((event) => event.allDay),
        periodStart: startOfDay(startOfView),
        periodEnd: endOfDay(endOfView),
    });
    return {
        events: dayViewEvents,
        width,
        allDayEvents,
        period: {
            events: eventsInPeriod,
            start: startOfView,
            end: endOfView,
        },
    };
}
function sanitiseHours(hours) {
    return Math.max(Math.min(23, hours), 0);
}
function sanitiseMinutes(minutes) {
    return Math.max(Math.min(59, minutes), 0);
}
function getDayViewHourGrid(dateAdapter, { viewDate, hourSegments, hourDuration, dayStart, dayEnd, }) {
    const { setMinutes, setHours, startOfDay, startOfMinute, endOfDay, addMinutes, addDays, } = dateAdapter;
    const hours = [];
    let startOfView = setMinutes(setHours(startOfDay(viewDate), sanitiseHours(dayStart.hour)), sanitiseMinutes(dayStart.minute));
    let endOfView = setMinutes(setHours(startOfMinute(endOfDay(viewDate)), sanitiseHours(dayEnd.hour)), sanitiseMinutes(dayEnd.minute));
    const segmentDuration = (hourDuration || MINUTES_IN_HOUR) / hourSegments;
    let startOfViewDay = startOfDay(viewDate);
    const endOfViewDay = endOfDay(viewDate);
    let dateAdjustment = (d) => d;
    // this means that we change from or to DST on this day and that's going to cause problems so we bump the date
    if (dateAdapter.getTimezoneOffset(startOfViewDay) !==
        dateAdapter.getTimezoneOffset(endOfViewDay)) {
        startOfViewDay = addDays(startOfViewDay, 1);
        startOfView = addDays(startOfView, 1);
        endOfView = addDays(endOfView, 1);
        dateAdjustment = (d) => addDays(d, -1);
    }
    const dayDuration = hourDuration
        ? (HOURS_IN_DAY * 60) / hourDuration
        : MINUTES_IN_HOUR;
    for (let i = 0; i < dayDuration; i++) {
        const segments = [];
        for (let j = 0; j < hourSegments; j++) {
            const date = addMinutes(addMinutes(startOfView, i * (hourDuration || MINUTES_IN_HOUR)), j * segmentDuration);
            if (date >= startOfView && date < endOfView) {
                segments.push({
                    date: dateAdjustment(date),
                    displayDate: date,
                    isStart: j === 0,
                });
            }
        }
        if (segments.length > 0) {
            hours.push({ segments });
        }
    }
    return hours;
}
var EventValidationErrorMessage;
(function (EventValidationErrorMessage) {
    EventValidationErrorMessage["NotArray"] = "Events must be an array";
    EventValidationErrorMessage["StartPropertyMissing"] = "Event is missing the `start` property";
    EventValidationErrorMessage["StartPropertyNotDate"] = "Event `start` property should be a javascript date object. Do `new Date(event.start)` to fix it.";
    EventValidationErrorMessage["EndPropertyNotDate"] = "Event `end` property should be a javascript date object. Do `new Date(event.end)` to fix it.";
    EventValidationErrorMessage["EndsBeforeStart"] = "Event `start` property occurs after the `end`";
})(EventValidationErrorMessage || (EventValidationErrorMessage = {}));
function validateEvents(events, log) {
    let isValid = true;
    function isError(msg, event) {
        log(msg, event);
        isValid = false;
    }
    if (!Array.isArray(events)) {
        log(EventValidationErrorMessage.NotArray, events);
        return false;
    }
    events.forEach((event) => {
        if (!event.start) {
            isError(EventValidationErrorMessage.StartPropertyMissing, event);
        }
        else if (!(event.start instanceof Date)) {
            isError(EventValidationErrorMessage.StartPropertyNotDate, event);
        }
        if (event.end) {
            if (!(event.end instanceof Date)) {
                isError(EventValidationErrorMessage.EndPropertyNotDate, event);
            }
            if (event.start > event.end) {
                isError(EventValidationErrorMessage.EndsBeforeStart, event);
            }
        }
    });
    return isValid;
}

/******/ 	return __webpack_exports__;
/******/ })()
;
});