const { academy, pricing } = window.DSAM_CONFIG;

const currency = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 });

document.querySelectorAll('[data-academy-address]').forEach((element) => { element.textContent = academy.address; });
document.querySelectorAll('[data-academy-email]').forEach((element) => { element.textContent = academy.email; });
document.querySelectorAll('[data-academy-phone]').forEach((element) => { element.textContent = academy.phone; });

// Mobile navigation
const menuToggle = document.getElementById('menuToggle');
const menuClose = document.getElementById('menuClose');
const mobileNav = document.getElementById('mobileNav');
const mobileOverlay = document.getElementById('mobileOverlay');

function openMenu() {
    mobileNav.classList.add('open');
    mobileOverlay.classList.add('open');
    document.body.classList.add('menu-open');
    menuToggle.setAttribute('aria-expanded', 'true');
    mobileNav.setAttribute('aria-hidden', 'false');
}

function closeMenu() {
    mobileNav.classList.remove('open');
    mobileOverlay.classList.remove('open');
    document.body.classList.remove('menu-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    mobileNav.setAttribute('aria-hidden', 'true');
}

menuToggle.addEventListener('click', openMenu);
menuClose.addEventListener('click', closeMenu);
mobileOverlay.addEventListener('click', closeMenu);

document.querySelectorAll('[data-close-menu]').forEach((el) => {
    el.addEventListener('click', closeMenu);
});

document.querySelectorAll('[data-scroll]').forEach((btn) => {
    btn.addEventListener('click', () => {
        const target = document.querySelector(btn.getAttribute('data-scroll'));
        if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
});

// Tuition calculator
const hourSlider = document.getElementById('hourSlider');
const monthSlider = document.getElementById('monthSlider');
const hourLabel = document.getElementById('hourLabel');
const monthLabel = document.getElementById('monthLabel');
const totalPriceDisplay = document.getElementById('totalPrice');
const addonsYes = document.getElementById('addonsYes');
const addonsNo = document.getElementById('addonsNo');

let inclusionPremium = pricing.masterclassFeeNgn;

function performCalculation() {
    const hours = parseInt(hourSlider.value, 10);
    const months = parseInt(monthSlider.value, 10);
    const finalOutput = hours * pricing.weeklyHourRateNgn * (months * 4) + inclusionPremium;
    totalPriceDisplay.textContent = currency.format(finalOutput);
}

hourSlider.addEventListener('input', (e) => {
    const value = e.target.value;
    hourLabel.textContent = `${value} ${value === '1' ? 'Hour' : 'Hours'}`;
    performCalculation();
});

monthSlider.addEventListener('input', (e) => {
    const value = e.target.value;
    monthLabel.textContent = `${value} ${value === '1' ? 'Month' : 'Months'}`;
    performCalculation();
});

addonsYes.addEventListener('click', () => {
    addonsYes.classList.add('active');
    addonsNo.classList.remove('active');
    inclusionPremium = pricing.masterclassFeeNgn;
    performCalculation();
});

addonsNo.addEventListener('click', () => {
    addonsNo.classList.add('active');
    addonsYes.classList.remove('active');
    inclusionPremium = 0;
    performCalculation();
});

performCalculation();

// Course filter tabs
const tabButtons = document.querySelectorAll('.tab-container .tab-btn');
const courseCards = document.querySelectorAll('.course-card');

tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
        tabButtons.forEach((btn) => btn.classList.remove('active'));
        button.classList.add('active');

        const filterValue = button.getAttribute('data-filter');

        courseCards.forEach((card) => {
            if (filterValue === 'all' || card.getAttribute('data-category') === filterValue) {
                card.classList.remove('hide');
            } else {
                card.classList.add('hide');
            }
        });
    });
});

// Enrollment form
const enrollmentForm = document.getElementById('enrollmentForm');
const formStatus = document.getElementById('formStatus');
const submitBtn = document.getElementById('submitBtn');

enrollmentForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (window.handleEnrollment) {
        window.handleEnrollment();
        return;
    }

    formStatus.textContent = '';
    formStatus.className = 'form-status';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    const formData = new FormData(enrollmentForm);
    const payload = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Submission failed');
        }

        formStatus.textContent = 'Application submitted successfully! We will be in touch soon.';
        formStatus.className = 'form-status success';
        enrollmentForm.reset();
    } catch (err) {
        formStatus.textContent = err.message || 'Something went wrong. Please try again.';
        formStatus.className = 'form-status error';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Formal Enrollment Application';
    }
});
