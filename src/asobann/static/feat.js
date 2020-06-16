import {el, mount, unmount, setAttr, setStyle} from "./redom.es.js";
import {allCardistry} from "./cardistry.js";
import {_} from "./i18n.js";

// import interact from './interact.js'

function arraysEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function toRect(c) {
    if (c.top && c.left && c.width && c.height) {
        return {
            top: parseFloat(c.top),
            left: parseFloat(c.left),
            height: parseFloat(c.height),
            width: parseFloat(c.width),
        }
    }
    if (c.el) {
        return {
            top: parseFloat(c.el.style.top),
            left: parseFloat(c.el.style.left),
            height: parseFloat(c.el.style.height),
            width: parseFloat(c.el.style.width),
        }
    }
    throw 'Cannot detect rect';
}

const draggability = {
    install: function (component) {
        function isDraggingPermitted() {
            return component.draggable && featsContext.canOperateOn(component);
        }

        interact(component.el).draggable({
            listeners: {
                move(event) {
                    if (!isDraggingPermitted()) {
                        return;
                    }
                    featsContext.table.consolidatePropagation(() => {
                        featsContext.fireEvent(component, draggability.events.onMoving,
                            {
                                top: parseFloat(component.el.style.top) + event.dy,
                                left: parseFloat(component.el.style.left) + event.dx,
                                dx: event.dx,
                                dy: event.dy,
                            });
                    });
                },
                end(event) {
                    if (!isDraggingPermitted()) {
                        return;
                    }
                    console.log("draggable end", component.componentId);
                    featsContext.table.consolidatePropagation(() => {
                        featsContext.fireEvent(component, featsContext.events.onPositionChanged,
                            {
                                top: parseFloat(component.el.style.top) + event.dy,
                                left: parseFloat(component.el.style.left) + event.dx,
                                height: parseFloat(component.el.style.height),
                                width: parseFloat(component.el.style.width),
                            });
                        featsContext.fireEvent(component, draggability.events.onMoveEnd, {});
                    });
                }
            }
        });

        featsContext.addEventListener(component, draggability.events.onMoving, (e) => {
            component.propagate_volatile({ top: e.top + "px", left: e.left + "px", moving: true });
        });

        featsContext.addEventListener(component, featsContext.events.onPositionChanged, (e) => {
            component.propagate({
                top: parseFloat(e.top) + "px",
                left: parseFloat(e.left) + "px",
                height: parseFloat(e.height) + "px",
                width: parseFloat(e.width) + "px",
                moving: false,
            });

        });
    },
    isEnabled: function (component, data) {
        return data.draggable === true;
    },
    onComponentUpdate: function (component, data) {
        component.draggable = data.draggable;
        component.ownable = data.ownable;  // TODO: good chance ownable will not be used
    },
    uninstall: function (component) {
        interact(component.el).draggable(false);
    },
    events: {
        onMoving: "draggability.onMoving",
        onMoveEnd: "draggability.onMoveEnd",
    }
};

const flippability = {
    install: function (component) {
        function isFlippingPermitted() {
            return component.flippable && featsContext.canOperateOn(component);
        }

        component.el.addEventListener("dblclick", () => {
            if (!isFlippingPermitted()) {
                return;
            }
            let diff = {};
            if (component.owner && component.owner !== featsContext.getPlayerName()) {
                return;
            }
            if (component.faceup) {
                diff.faceup = component.faceup = false;
            } else {
                diff.faceup = component.faceup = true;
            }
            component.propagate(diff);
        });
    },
    isEnabled: function (component, data) {
        return data.flippable === true;
    },
    onComponentUpdate: function (component, data) {
        component.flippable = data.flippable;
        component.owner = data.owner;
        component.faceup = data.faceup;
        if (component.faceup) {
            if (!component.owner || component.owner === featsContext.getPlayerName()) {
                if (data.showImage) {
                    setAttr(component.image, { src: data.faceupImage });
                }
                if (data.faceupText) {
                    component.textEl.innerText = data.faceupText;
                } else {
                    component.textEl.innerText = '';
                }
            } else {
                if (data.showImage) {
                    setAttr(component.image, { src: data.facedownImage });
                }
                if (data.facedownText) {
                    component.textEl.innerText = data.facedownText;
                } else {
                    component.textEl.innerText = '';
                }
            }
        } else {
            if (data.showImage) {
                setAttr(component.image, { src: data.facedownImage });
            }
            if (data.faceupText) {
                component.textEl.innerText = data.facedownText;
            } else {
                component.textEl.innerText = '';
            }
        }
        component.faceup = data.faceup;

    },
    uninstall: function (component) {
    },

};


const resizability = {
    install: function (component) {
        function isResizingPermitted() {
            return component.resizable && featsContext.canOperateOn(component);
        }

        interact(component.el).resizable({
            edges: {
                top: true,
                left: true,
                bottom: true,
                right: true,
            },
            invert: 'reposition',

            onmove: (event) => {
                if (!isResizingPermitted()) {
                    return;
                }
                let top = parseFloat(component.el.style.top) + event.deltaRect.top;
                let left = parseFloat(component.el.style.left) + event.deltaRect.left;
                let width = parseFloat(component.el.style.width) + event.deltaRect.width;
                let height = parseFloat(component.el.style.height) + event.deltaRect.height;
                component.propagate_volatile({ top: top, left: left, width: width, height: height });
            },
            onend: (event) => {
                if (!isResizingPermitted()) {
                    return;
                }
                // resizeend event have wrong value in deltaRect so just ignore it
                let top = parseFloat(component.el.style.top);
                let left = parseFloat(component.el.style.left);
                let width = parseFloat(component.el.style.width);
                let height = parseFloat(component.el.style.height);
                featsContext.fireEvent(component, featsContext.events.onPositionChanged,
                    {
                        top: top,
                        left: left,
                        height: height,
                        width: width,
                    });
            },
        })
    },
    isEnabled: function (component, data) {
        return data.resizable === true;
    },
    onComponentUpdate: function (component, data) {
        component.resizable = data.resizable;
    },
    uninstall: function (component) {
        interact(component.el).resizable(false);
    },
};

const rollability = {
    install: function (component) {
        function isRollingPermitted() {
            return component.rollable && featsContext.canOperateOn(component);
        }

        component.el.addEventListener("dblclick", startRoll);

        function startRoll(event) {
            if (!isRollingPermitted()) {
                return;
            }
            if (component.rolling) {
                return false;
            }
            const duration = Math.random() * 1000 + 500;
            const finalValue = Math.floor(Math.random() * 6) + 1;
            component.rolling = true;
            component.propagate({ rollDuration: duration, rollFinalValue: finalValue, startRoll: true });
            return false;
        }
    },
    isEnabled: function (component, data) {
        return data.rollable === true;
    },
    onComponentUpdate: function (component, data) {
        component.rollable = data.rollable;

        if (data.startRoll) {
            data.startRoll = undefined;
            component.rolling = true;
            rollability.roll(component, data.rollDuration, data.rollFinalValue);
        }

        if (data.rollFinalValue && !component.rolling) {
            if (data.rollFinalValue === component.rollCurrentValue) {
                return;
            }
            const previousEls = [];
            for (const e of component.el.children) {
                if (e.className === 'dice_image') {
                    previousEls.push(e);
                }
            }
            for (const e of previousEls) {
                unmount(component.el, e);
            }
            const finalEl = el("div.dice_image", { style: { width: "100%", height: "100%" } });
            setStyle(finalEl, {
                animation: 'none',
                backgroundImage: `url("/static/images/dice_blue_${data.rollFinalValue}.jpg")`,
                backgroundSize: '100% 100%',
                backgroundPosition: 'left',
                backgroundRepeat: 'no-repeat',
            });
            mount(component.el, finalEl);
            component.rollCurrentValue = data.rollFinalValue;
        }
    },
    uninstall: function (component) {
    },
    roll: function (component, duration, finalValue) {
        const ANIMATION_INTERVAL = 200;

        component.rolling = true;
        component.rollCurrentValue = null;
        const fromValue = Math.floor(Math.random() * 6) + 1;
        const toValue = Math.floor(Math.random() * 6) + 1;
        const startTime = Date.now();
        let previousRollingEl = null;
        for (const e of component.el.children) {
            if (e.className === 'dice_image') {
                previousRollingEl = e;
            }
        }
        showRolling(fromValue, toValue, previousRollingEl);

        function showRolling(fromValue, toValue, previousRollingEl) {
            if (previousRollingEl) {
                unmount(component.el, previousRollingEl);
            }
            // repeating animation requires new element
            const rollingEl = el("div.dice_image", { style: { width: "100%", height: "100%" } });
            setStyle(rollingEl, {
                animation: `dice_rolling ${ANIMATION_INTERVAL}ms linear 0s 1  `,
                backgroundImage: `url("/static/images/dice_blue_${toValue}.jpg"), url("/static/images/dice_blue_${fromValue}.jpg")`,
                backgroundPosition: 'left, right',
                backgroundRepeat: 'no-repeat, no-repeat',
            });
            mount(component.el, rollingEl);

            if (Date.now() < startTime + duration - ANIMATION_INTERVAL) {
                setTimeout(() => showRolling(toValue, Math.floor(Math.random() * 6) + 1, rollingEl), ANIMATION_INTERVAL);
            } else if (Date.now() < startTime + duration) {
                setTimeout(() => showRolling(toValue, finalValue, rollingEl), ANIMATION_INTERVAL);
            } else {
                setTimeout(() => {
                    component.rolling = false;
                    component.propagate({ rollDuration: 0, rollFinalValue: finalValue, startRoll: false });
                }, ANIMATION_INTERVAL);
            }

        }
    }
};

/* not used for the time being */
/*
const collidability = {
    install: function (component) {
        if (!component.currentCollisions) {
            component.currentCollisions = {};
        }

        featsContext.addEventListener(component, featsContext.events.onPositionChanged, (e) => {
            const collided = pickCollidedComponents();
            processAllStart(collided);
            processAllEnd(collided);

            function pickCollidedComponents() {
                const collided = [];
                for (const componentId in featsContext.table.componentsOnTable) {
                    const target = featsContext.table.componentsOnTable[componentId];
                    if (target === component) {
                        continue;
                    }
                    if (!areTheyCollidable(component, target)) {
                        continue;
                    }
                    if (isOverlapped({ top: e.top, left: e.left, height: e.height, width: e.width }, target)) {
                        collided.push(target);
                    }
                }
                return collided;
            }

            function areTheyCollidable(c1, c2) {
                if (c1.traylike && !c2.traylike) {
                    return true;
                }
                if (!c1.traylike && c2.traylike) {
                    return true;
                }
                return false;
            }

            function isOverlapped(c1, c2) {
                const rect1 = toRect(c1);
                const rect2 = toRect(c2);
                return (rect1.left <= rect2.left + rect2.width &&
                    rect2.left <= rect1.left + rect1.width &&
                    rect1.top <= rect2.top + rect2.height &&
                    rect2.top <= rect1.top + rect1.height);
            }

            function processAllStart(collided) {
                for (const other of collided) {
                    if (component.currentCollisions[other.componentId]) {
                        continue;
                    }
                    component.currentCollisions[other.componentId] = true;
                    other.currentCollisions[component.componentId] = true;

                    component.propagate({ 'currentCollisions': component.currentCollisions });
                    other.propagate({ 'currentCollisions': other.currentCollisions });
                    featsContext.fireEvent(component, collidability.events.onCollisionStart, { collider: other });
                    featsContext.fireEvent(other, collidability.events.onCollisionStart, { collider: component });
                }
            }

            function processAllEnd(collided) {
                for (const componentId in component.currentCollisions) {
                    if (collided.find(e => e.componentId === componentId)) {
                        continue;
                    }

                    delete component.currentCollisions[componentId];
                    component.propagate({ 'currentCollisions': component.currentCollisions });

                    const other = featsContext.table.componentsOnTable[componentId];
                    if (other) {
                        // there is a chance that other is already removed from table
                        delete other.currentCollisions[component.componentId];

                        other.propagate({ 'currentCollisions': other.currentCollisions });
                        featsContext.fireEvent(component, collidability.events.onCollisionEnd, { collider: other });
                        featsContext.fireEvent(other, collidability.events.onCollisionEnd, { collider: component });
                    }
                }
            }

        });
    },
    isEnabled: function (component, data) {
        return true;
    },
    onComponentUpdate: function (component, data) {
        if (data.currentCollisions) {
            component.currentCollisions = data.currentCollisions;
        }

        component.moving = data.moving;
    },
    uninstall: function (component) {
        const currentCollisions = component.currentCollisions;
        component.currentCollisions = [];  // avoid recurse
        for (const componentId in currentCollisions) {
            const other = featsContext.table.componentsOnTable[componentId];
            if (other) {
                // there is a chance that other is already removed from table
                delete other.currentCollisions[component.componentId];

                other.propagate({ 'currentCollisions': other.currentCollisions });
                featsContext.fireEvent(component, collidability.events.onCollisionEnd, { collider: other });
                featsContext.fireEvent(other, collidability.events.onCollisionEnd, { collider: component });
            }
        }
    },

    events: {
        onCollisionStart: 'collidability.onCollisionStart',
        onCollisionEnd: 'collidability.onCollisionEnd',
    },
};
*/

const within = {
    install: function (component) {
        if (!component.thingsWithinMe) {
            component.thingsWithinMe = {};
            component.iAmWithin = {};
        }

        featsContext.addEventListener(component, featsContext.events.onPositionChanged, (e) => {
            const withinCheckResult = pickCollidedComponents();
            processAllStart(withinCheckResult);
            processAllEnd(withinCheckResult);

            function pickCollidedComponents() {
                const thingsWithinMe = [];
                const iAmWithin = [];
                for (const componentId in featsContext.table.componentsOnTable) {
                    // noinspection JSUnfilteredForInLoop
                    const target = featsContext.table.componentsOnTable[componentId];
                    if (target === component) {
                        continue;
                    }
                    if (canThisEverWithin(component, target)) {
                        if (isWithin({ top: e.top, left: e.left, height: e.height, width: e.width }, target)) {
                            thingsWithinMe.push(target);
                        }
                    }
                    if (canThisEverWithin(target, component)) {
                        if (isWithin(target, { top: e.top, left: e.left, height: e.height, width: e.width })) {
                            iAmWithin.push(target);
                        }
                    }

                }
                return { thingsWithinMe: thingsWithinMe, iAmWithin: iAmWithin };
            }

            function canThisEverWithin(area, visitor) {
                if (area.traylike && !visitor.traylike) {
                    return true;
                }
                return false;
            }

            function isWithin(area, visitor) {
                const areaRect = toRect(area);
                const visitorRect = toRect(visitor);
                return (areaRect.left <= visitorRect.left &&
                    visitorRect.left + visitorRect.width <= areaRect.left + areaRect.width &&
                    areaRect.top <= visitorRect.top &&
                    visitorRect.top + visitorRect.height <= areaRect.top + areaRect.height);
            }

            function processAllStart(withinCheckResult) {
                console.log("processAllStart start");
                const thingsWithinMe = withinCheckResult.thingsWithinMe;
                const iAmWithin = withinCheckResult.iAmWithin;
                for (const other of thingsWithinMe) {
                    processStartWithin(component, other);
                }

                for (const other of iAmWithin) {
                    processStartWithin(other, component);
                }
                console.log("processAllStart end");

                function processStartWithin(area, visitor) {
                    if (area.thingsWithinMe[visitor.componentId]) {
                        return;
                    }
                    area.thingsWithinMe[visitor.componentId] = true;
                    visitor.iAmWithin[area.componentId] = true;

                    area.propagate({ 'thingsWithinMe': area.thingsWithinMe });
                    visitor.propagate({ 'iAmWithin': visitor.iAmWithin });
                    featsContext.fireEvent(area, within.events.onWithin, { visitor: visitor });
                }
            }

            function processAllEnd(withinCheckResult) {
                console.log("processAllEnd start");

                for (const visitorId in component.thingsWithinMe) {
                    if (withinCheckResult.thingsWithinMe.find(e => e.componentId === visitorId)) {
                        continue;
                    }

                    delete component.thingsWithinMe[visitorId];
                    component.propagate({ 'thingsWithinMe': component.thingsWithinMe });

                    const other = featsContext.table.componentsOnTable[visitorId];
                    if (other) {
                        // there is a chance that other is already removed from table
                        delete other.iAmWithin[component.componentId];

                        other.propagate({ 'iAmWithin': other.iAmWithin });
                        featsContext.fireEvent(component, within.events.onWithinEnd, { visitor: other });
                    }
                }

                for (const otherId in component.iAmWithin) {
                    if (withinCheckResult.iAmWithin.find(e => e.componentId === otherId)) {
                        continue;
                    }

                    delete component.iAmWithin[otherId];
                    component.propagate({ 'iAmWithin': component.iAmWithin });

                    const other = featsContext.table.componentsOnTable[otherId];
                    if (other) {
                        // there is a chance that other is already removed from table
                        delete other.thingsWithinMe[component.componentId];

                        other.propagate({ 'thingsWithinMe': other.thingsWithinMe });
                        featsContext.fireEvent(other, within.events.onWithinEnd, { visitor: component });
                    }
                }
                console.log("processAllEnd end");

            }

        });
    },
    isEnabled: function (component, data) {
        return true;
    },
    onComponentUpdate: function (component, data) {
        if (data.thingsWithinMe) {
            component.thingsWithinMe = data.thingsWithinMe;
        }
        if (data.iAmWithin) {
            component.iAmWithin = data.iAmWithin;
        }

        component.moving = data.moving;
    },
    uninstall: function (component) {
        const thingsWithinMe = component.thingsWithinMe;
        const iAmWithin = component.iAmWithin;
        component.thingsWithinMe = [];  // avoid recurse
        component.iAmWithin = [];  // avoid recurse
        for (const componentId in thingsWithinMe) {
            const other = featsContext.table.componentsOnTable[componentId];
            if (other) {
                // there is a chance that other is already removed from table
                delete other.iAmWithin[component.componentId];

                other.propagate({ 'iAmWithin': other.iAmWithin });
                featsContext.fireEvent(component, within.events.onWithinEnd, { visitor: other });
            }
        }
        for (const otherId in iAmWithin) {
            const other = featsContext.table.componentsOnTable[otherId];
            if (other) {
                // there is a chance that other is already removed from table
                delete other.thingsWithinMe[component.componentId];

                other.propagate({ 'thingsWithinMe': other.thingsWithinMe });
                featsContext.fireEvent(other, within.events.onWithinEnd, { visitor: component });
            }
        }
    },

    events: {
        onWithin: 'within.onCollisionStart',
        onWithinEnd: 'within.onCollisionEnd',
    },
};

const ownership = {
    install: function (component) {
        featsContext.addEventListener(component, within.events.onWithin, (e) => {
            const other = e.visitor;
            if (component.handArea && !other.handArea) {
                const hand = component;
                const onHand = other;
                if (!(onHand.owner === hand.owner)) {
                    onHand.propagate({ owner: onHand.owner = hand.owner });
                }
            }
        });
        featsContext.addEventListener(component, within.events.onWithinEnd, (e) => {
            const other = e.visitor;
            if (component.handArea && !other.handArea) {
                const hand = component;
                const onHand = other;
                if (onHand.owner === hand.owner) {
                    onHand.propagate({ owner: onHand.owner = null });
                }
            }
        });
    },
    isEnabled: function (component, data) {
        return true;
    },
    onComponentUpdate: function (component, data) {
        if (component.owner !== data.owner) {
            console.log("ownership update change", component.componentId, component.owner, "to", data.owner);
        }
        component.owner = data.owner;
        component.handArea = data.handArea;
        if (component.moving) {
            return;
        }
        if (!component.handArea) {
            if (component.owner) {
                setStyle(component.el, {
                    boxShadow: '0 0 20px green',
                })
            } else {
                setStyle(component.el, {
                    boxShadow: null,
                })
            }
        }
    },
    uninstall: function (component) {

    }
};


const handArea = {
    install: function (component, componentData) {
        if (componentData.handArea) {
            component.handArea = componentData.handArea;
            const className = component.el.getAttribute('class');
            if (!className.includes('hand_area')) {
                setAttr(component.el, 'class', className + ' hand_area');
            }
        }
    },
    isEnabled: function (component, data) {
        return data.handArea === true;
    },
    onComponentUpdate: function () {
    },
    uninstall: function () {

    }
};

const traylike = {
    // This feat is for tray-like object.  Non tray-like object can be put on tray-like objects.
    // Objects on a tray moves with the tray.
    // Hand Area is a tray-like object.  A box is another example of tray-like object.
    // Currently everything not tray-like can be put on tray-like.  Tray-like does not be put on another tray-like.
    install: function (component) {
        component.onTray = {};

        featsContext.addEventListener(component, within.events.onWithin, (e) => {
            if (!component.traylike) {
                return;
            }
            if (e.visitor.traylike) {
                return;
            }
            component.onTray[e.visitor.componentId] = true;
            component.propagate({ onTray: component.onTray });
            if (e.visitor.zIndex < component.zIndex) {
                e.visitor.propagate({ zIndex: featsContext.table.getNextZIndex() });
            }
        });

        featsContext.addEventListener(component, within.events.onWithinEnd, (e) => {
            if (!component.traylike) {
                return;
            }
            if (e.visitor.traylike) {
                return;
            }
            delete component.onTray[e.visitor.componentId];
            component.propagate({ onTray: component.onTray });
        });

        featsContext.addEventListener(component, draggability.events.onMoving, (e) => {
            if (!component.traylike) {
                return;
            }
            const dx = e.dx;
            const dy = e.dy;
            for (const componentId in component.onTray) {
                const target = featsContext.table.componentsOnTable[componentId];
                target.propagate_volatile({
                    top: parseFloat(target.el.style.top) + dy,
                    left: parseFloat(target.el.style.left) + dx
                });
            }
        });

        featsContext.addEventListener(component, draggability.events.onMoveEnd, (e) => {
            if (!component.traylike) {
                return;
            }
            for (const componentId in component.onTray) {
                const target = featsContext.table.componentsOnTable[componentId];
                target.propagate({
                    top: target.el.style.top,
                    left: target.el.style.left
                });
            }
        })
    },
    isEnabled: function (component, data) {
        return data.traylike === true;
    },
    onComponentUpdate: function (component, data) {
        // On or off of a tray decision is handled in tray-like object's update.
        // This is chiefly to reduce computation.  And also for simplicity.
        component.traylike = data.traylike;
        if (data.onTray) {
            component.onTray = data.onTray;
        }
    },
    uninstall: function (component) {

    }
};

const touchToRaise = {
    install: function (component) {
        component.el.addEventListener("mousedown", (ev) => {
            if (featsContext.isPlayerObserver()) {
                return;
            }
            if (component.handArea || component.traylike) {
                return;
            }
            component.zIndex = featsContext.table.getNextZIndex();
            setStyle(component.el, { zIndex: component.zIndex });
            component.propagate({ zIndex: component.zIndex });
        });
    },

    isEnabled: function (component, data) {
        return true;
    },

    onComponentUpdate: function (component, data) {
        if (data.zIndex) {
            component.zIndex = data.zIndex;
        } else {
            component.zIndex = featsContext.table.getNextZIndex();
        }
    },

    uninstall: function (component) {
    }
};

const cardistry = {
    install: function (component, data) {
        if (!data.cardistry) {
            return;
        }
        component.cardistry = {};
        setStyle(component.el, {
            'flex-flow': 'column wrap',
            'justify-content': 'left',
            'align-items': 'flex-start'
        });

        for (const cardistry of allCardistry) {
            const button = el('button', {
                    onclick: () => {
                        cardistry.execute(component, featsContext);
                    },
                },
                cardistry.label,
            );
            component.el.appendChild(button);
            const entry = {
                button: button,
            };
            component.cardistry[cardistry.name] = entry;
        }
    },
    isEnabled: function (component, data) {
        return true;
    },
    onComponentUpdate: function (component, componentData) {
        if (!componentData.cardistry) {
            return;
        }

        for (const cardistry of allCardistry) {
            if (componentData.cardistry.includes(cardistry.name)) {
                setStyle(component.cardistry[cardistry.name].button, { display: null });
                if (cardistry.isEnabled(component, featsContext)) {
                    setAttr(component.cardistry[cardistry.name].button, 'disabled', null);
                } else {
                    setAttr(component.cardistry[cardistry.name].button, 'disabled', true);
                }
                cardistry.onComponentUpdate(component, componentData);
            } else {
                setStyle(component.cardistry[cardistry.name].button, { display: 'none' });
            }
        }
    },
    uninstall: function (component) {
    }
};

const featsContext = {
    canOperateOn: function (component) {
        return ((!component.owner || component.owner === featsContext.getPlayerName())
            && !featsContext.isPlayerObserver());
    },
    addEventListener: function (component, eventName, handler) {
        if (!eventName) {
            throw `addEventListener: eventName must be specified but was ${eventName}`
        }
        if (!featsContext.eventListeners[eventName]) {
            featsContext.eventListeners[eventName] = [];
        }
        featsContext.eventListeners[eventName].push({ component: component, handler: handler });
    },
    fireEvent: function (component, eventName, event) {
        if (!eventName) {
            throw `fireEvent: eventName must be specified but was ${eventName}`
        }
        if (!featsContext.eventListeners[eventName]) {
            return;
        }
        for (const entry of featsContext.eventListeners[eventName]) {
            if (entry.component === component) {
                entry.handler(event);
            }
        }
    },
    eventListeners: {},
    events: {
        /*
        This event is fired when position or size of component is changed.
        Event must have these parameters.
            top:
            left:
            height:
            width:
            moving: true if in transition (being dragged)
         */
        onPositionChanged: 'onPositionChanged',
    }
};

function setFeatsContext(getPlayerName, isPlayerObserver, table) {
    featsContext.getPlayerName = getPlayerName;
    featsContext.isPlayerObserver = isPlayerObserver;
    featsContext.table = table;
}

const event = {
    events: featsContext.events,
    fireEvent: function (component, eventName, event) {
        featsContext.fireEvent(component, eventName, event);
    }
};

const feats = [
    within,
    draggability,
    flippability,
    resizability,
    rollability,
    traylike,
    handArea,
    ownership,
    touchToRaise,
    cardistry
];

export {setFeatsContext, feats, event};