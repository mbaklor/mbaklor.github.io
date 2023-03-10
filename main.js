const cardNums = ["A", 2, 3, 4, 5, 6, 7, 8, 9, 10, "J", "Q", "K"];
const cardSuite = ["♠", "♥", "♦", "♣"];

// Elements from the DOM
const cards = document.querySelectorAll(".card");
const slots = document.querySelectorAll(".card-slot");
const suitPiles = document.querySelectorAll(".suit-pile");
const cardSections = document.querySelectorAll(".card-section");
const resetButton = document.querySelector("#reset-cards");
const touchFloat = document.querySelector("#float-touch-zone");
let dragCard;
let sourceSection;
let touchTarget;
let touchMove = false;
let movableCards = 5;

const showAlertMessage = (message) => {
    const alert = document.querySelector("#alert");
    alert.innerHTML = message;
    alert.classList.add("show-alert");
    setTimeout(() => {
        alert.classList.remove("show-alert");
    }, 3000);
};
// Fisher-Yates shuffle, as implemented by Mike Bostock, copied from https://bost.ocks.org/mike/shuffle/
const shuffle = (array) => {
    let len = array.length;
    let randomIndex;
    let copyDummy;

    // While there are remaining elements to shuffle
    while (len) {
        // Pick a remaining element
        randomIndex = Math.floor(Math.random() * len--);

        // And swap it with the current element
        copyDummy = array[len];
        array[len] = array[randomIndex];
        array[randomIndex] = copyDummy;
    }
    return array;
};
let allCards = shuffle(cardNums.flatMap((num) => cardSuite.map((suite) => suite + num)));

// Functions to find nested card number or parent
const childCardCount = (card) => {
    const children = card.children;
    for (let i = 0; i < children.length; i++) {
        if (children[i].classList.contains("card")) return 1 + childCardCount(children[i]);
    }
    return 1;
};

const getParentSection = (card) => {
    const parent = card.parentNode;
    if (parent.classList.contains("card")) return getParentSection(parent);
    else return parent;
};

const IsValidChain = (card) => {
    const child = card.querySelector(".card");
    if (child) {
        if (!IsValidChild(card, child)) return false;
        else {
            return IsValidChain(child);
        }
    }
    return true;
};

const IsValidChild = (parent, child) => {
    const childColor = child.dataset.color;
    const childNumber = FaceOfCard(child.id)[1];

    const parentColor = parent.dataset.color;
    const parentNumber = FaceOfCard(parent.id)[1];

    return childColor !== parentColor && childNumber === parentNumber - 1;
};

const SymbolToSuite = (symbol) => {
    let suite;
    switch (symbol) {
        case "♠":
            suite = "spade";
            break;
        case "♥":
            suite = "heart";
            break;
        case "♦":
            suite = "diamond";
            break;
        case "♣":
            suite = "club";
            break;
    }
    return suite;
};

const FaceOfCard = (face) => {
    const suit = face.substring(0, 1);
    const number = cardNums.findIndex((x) => x == face.substring(1)) + 1;
    return [suit, number];
};

const InitCard = (card, index) => {
    const textElements = card.querySelectorAll(".card-text");
    textElements.forEach((text) => {
        text.textContent = allCards[index];
    });
    card.classList.remove("in-pile");
    card.draggable = true;
    card.id = allCards[index];
    if (allCards[index].includes("♥") || allCards[index].includes("♦")) {
        card.dataset.color = "red";
    } else {
        card.dataset.color = "black";
    }
};

const UpdateMovable = () => {
    const emptySlots = document.querySelectorAll(".card-slot[data-filled='false']").length + 1;
    const emptySections = document.querySelectorAll(".card-section[data-filled='false']").length + 1;
    movableCards = emptySlots * emptySections;
};

const UpdateStack = (source) => {
    const oldStack = source.querySelectorAll(".card");
    if (oldStack.length === 0) source.dataset.filled = "false";
    oldStack.forEach((card) => {
        card.dataset.stack = childCardCount(card);
    });
};

const UpdateLastCard = () => {
    const lastCards = document.querySelectorAll(".card[data-stack='1'][draggable='true']");
    lastCards.forEach((card) => {
        const [suit, number] = FaceOfCard(card.id);
        const pile = document.querySelector(`.suit-pile#${SymbolToSuite(suit)}`);
        const next = pile.dataset.next;
        if (next === card.id) {
            const otherColor = [];
            suitPiles.forEach((x) => {
                if (x.dataset.color !== card.dataset.color) otherColor.push(FaceOfCard(x.dataset.next)[1]);
            });
            if (otherColor.every((x) => number - 1 <= x || (number === 13 && x === 0))) {
                if (!card.classList.contains("moving-to-pile")) cardToPile(card, pile);
            }
        }
    });
};

const touchCardLocation = (e) => {
    const srcLoc = dragCard.parentElement.getBoundingClientRect();
    const x = e.changedTouches[0].clientX;
    const y = e.changedTouches[0].clientY;
    const w = dragCard.offsetWidth;
    const h = dragCard.offsetHeight;
    const touchX = x - srcLoc.left - w / 2;
    const touchY = y - srcLoc.top - h / 2;
    document.documentElement.style.setProperty("--touchX", touchX.toFixed(2) + "px");
    document.documentElement.style.setProperty("--touchY", touchY.toFixed(2) + "px");
};

// iteration on DOM elements
resetButton.addEventListener("mousedown", resetBoard);

resetButton.addEventListener("mouseup", () => {
    resetButton.classList.remove("reset-clicked");
});

cards.forEach((card, index) => {
    InitCard(card, index);
    card.addEventListener("dragstart", cardStartDrag);
    card.addEventListener("dragend", cardEndDrag);
    card.addEventListener("dblclick", cardDblClick);

    card.addEventListener("touchstart", cardTouchStart);
    card.addEventListener("touchend", cardTouchEnd);
    card.addEventListener("touchcancel", cardTouchCancel);
    card.addEventListener("touchmove", cardTouchMove);
    card.dataset.stack = childCardCount(card);
});

slots.forEach((slot) => {
    slot.addEventListener("dragover", dragOver);
    slot.addEventListener("drop", dropToSlot);
});

suitPiles.forEach((pile) => {
    pile.addEventListener("dragover", dragOver);
    pile.addEventListener("drop", dropToPile);
});

cardSections.forEach((section) => {
    section.addEventListener("dragover", dragOver);
    section.addEventListener("drop", dropInBoard);
});

function cardTouchStart(e) {
    e.stopPropagation();
    touchMove = false;
    if (this.getAttribute("draggable") === "true") {
        cardStartDrag(e);
    }
}
function cardTouchEnd(e) {
    e.stopPropagation();
    if (touchMove) {
        let dropped = false;
        const dropEvent = new DragEvent("drop");
        if (touchTarget && touchTarget !== sourceSection) {
            dropped = touchTarget.dispatchEvent(dropEvent);
        }
        cardEndDrag(e);
        this.classList.remove("touch-dragged");
    }
}

function cardTouchCancel(e) {
    e.stopPropagation();
    console.log("Cancel", e);
}
function cardTouchMove(e) {
    e.stopPropagation();
    if (touchMove) {
        touchCardLocation(e);
        const x = e.changedTouches[0].clientX;
        const y = e.changedTouches[0].clientY;
        const targets = document.elementsFromPoint(x, y);
        const indexCard = targets.findIndex((x) => x === dragCard);
        const indexMain = targets.findIndex((x) => x.tagName === "MAIN");
        if (indexCard > -1 && indexMain > -1) {
            const classOpts = ["card-slot", "suit-pile", "card-section"];
            targets.forEach((target) => {
                if (classOpts.some((name) => target.classList.contains(name))) {
                    touchTarget = target;
                    return;
                }
            });
        } else {
            touchTarget = null;
        }
    }
}

// Drag and drop functions
function cardStartDrag(e) {
    const thisCard = e.target.tagName === "SPAN" ? e.target.parentElement : e.target;
    e.stopPropagation();
    if (!IsValidChain(thisCard)) {
        e.preventDefault();
        return;
    }
    if (thisCard.dataset.stack > movableCards) {
        e.preventDefault();
        showAlertMessage(
            `can't move this many cards!<br>
            you can only move <strong>${movableCards}</strong> cards, you tried moving <strong>${thisCard.dataset.stack}</strong>`
        );
        return;
    }
    dragCard = thisCard;
    sourceSection = getParentSection(thisCard);
    if (e.type === "touchstart") {
        touchMove = true;
        touchCardLocation(e);
        thisCard.classList.add("touch-dragged");
    }

    setTimeout(() => thisCard.classList.add("invisible"), 0);
}

function cardEndDrag(e) {
    e.stopPropagation();
    dragCard.classList.remove("invisible");
    UpdateStack(sourceSection);
    sourceSection = null;
    UpdateMovable();
    UpdateLastCard();
}

function cardDblClick(e) {
    e.stopPropagation();
    const currentLocation = getParentSection(this);
    if (this.dataset.stack === "1" && currentLocation.classList.contains("card-section")) {
        for (let i = 0; i < 4; i++) {
            if (slots[i].dataset.filled === "false") {
                animateCardToDest(this, slots[i], 100, () => {
                    slots[i].appendChild(this);
                    slots[i].dataset.filled = "true";
                    UpdateStack(currentLocation);
                    UpdateMovable();
                    UpdateLastCard();
                });
                break;
            }
        }
    }
}

function cardToPile(card, pile) {
    card.classList.add("moving-to-pile");
    animateCardToDest(card, pile, 100, () => {
        const [suit, number] = FaceOfCard(card.id);
        const currentLocation = getParentSection(card);
        pile.appendChild(card);
        card.classList.add("in-pile");
        pile.dataset.next = `${suit}${cardNums[number]}`;
        card.draggable = false;
        card.classList.remove("moving-to-pile");
        UpdateStack(currentLocation);
        UpdateMovable();
        UpdateLastCard();
    });
}

function dragOver(e) {
    e.preventDefault();
}

function dropToSlot() {
    if (this.dataset.filled === "false" && dragCard.dataset.stack === "1") {
        this.dataset.filled = "true";
        this.appendChild(dragCard);
        return true;
    }
}

function dropToPile() {
    const [suit, number] = FaceOfCard(dragCard.id);
    if (this.dataset.next === dragCard.id && dragCard.dataset.stack === "1") {
        this.appendChild(dragCard);
        dragCard.classList.add("in-pile");
        this.dataset.next = `${suit}${cardNums[number]}`;
        dragCard.draggable = false;
    }
}

function dropInBoard() {
    if (sourceSection !== this) {
        const lastCard = this.querySelector(".card[data-stack='1']");
        if (lastCard) {
            if (IsValidChild(lastCard, dragCard)) lastCard.appendChild(dragCard);
        } else this.appendChild(dragCard);

        const newStack = this.querySelectorAll(".card");
        newStack.forEach((card) => {
            card.dataset.stack = childCardCount(card);
        });
        if (this.dataset.filled === "false") this.dataset.filled = "true";
    }
}

function resetBoard() {
    allCards = shuffle(cardNums.flatMap((num) => cardSuite.map((suite) => suite + num)));
    this.classList.add("reset-clicked");
    slots.forEach((slot) => (slot.dataset.filled = "false"));
    suitPiles.forEach((pile) => {
        const suit = FaceOfCard(pile.dataset.next)[0];
        pile.dataset.next = `${suit}A`;
    });
    for (let sec = 0; sec < 8; sec++) {
        let currentElem = cardSections[sec];
        currentElem.dataset.filled = "true";
        let cardCount = sec < 4 ? 7 : 6;
        let startPoint = sec * cardCount + (sec < 4 ? 0 : 4);
        for (let i = startPoint; i < startPoint + cardCount; i++) {
            currentElem.appendChild(cards[i]);
            InitCard(cards[i], i);
            currentElem = cards[i];
        }
    }

    cards.forEach((card, index) => {
        card.dataset.stack = childCardCount(card);
    });
}

function animateCardToDest(card, dest, duration, cb) {
    const destRect = dest.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    card.animate(
        [
            // { transform: `translateY(0px) translateX(0px)` },
            { transform: `translateY(${destRect.top - cardRect.top}px) translateX(${destRect.left - cardRect.left}px)` },
        ],
        {
            duration: duration,
            iterations: 1,
            easing: "ease-in",
        }
    );
    setTimeout(cb, duration);
}
