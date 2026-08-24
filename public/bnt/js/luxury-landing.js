const initLuxuryLanding = () => {
    const experiences = [
        { 
            tier: "EXPERIENCE 01 / 14",
            title: "Immersive Themed Productions", 
            price: "Pricing on inquiry — submit details for a custom proposal within 4 hours.", 
            pills: ["Bangkok Mob", "Masquerade", "100+ Guests"], 
            category: "PRODUCTION",
            img: "/bnt/images/immersive-productions.jpg", 
            inc: "Turnkey high-concept large events. Complete set design, venue transformation, specialized visual effects, and custom talent casting based on our landmark concepts like Bangkok Mob and Bangkok Masquerade." 
        },
        { 
            tier: "EXPERIENCE 02 / 14",
            title: "VIP Table Bookings", 
            price: "Pricing on inquiry — submit details for a custom proposal within 4 hours.", 
            pills: ["Top Clubs", "Skip Lines", "Best Tables"], 
            category: "LUXURY",
            img: "/bnt/images/vip-table-bookings.jpg", 
            inc: "Access to the best tables at Sing Sing, Levels, and premier venues. Instant entry list skip-the-line validation. (Venue minimum spends apply)." 
        },
        { 
            tier: "EXPERIENCE 03 / 14",
            title: "Yacht Party — Pattaya", 
            price: "From 3,000 THB / person", 
            pills: ["Private Cruise", "Sunset View", "10-30 Pax"], 
            category: "LUXURY",
            img: "/bnt/images/yacht-party.jpg", 
            inc: "4-hour private charter, captain and crew, sound system, drinks package, and a dedicated party host." 
        },
        { 
            tier: "EXPERIENCE 04 / 14",
            title: "Penthouse Party", 
            price: "From 25,000 THB flat", 
            pills: ["Your Space", "Club Lights", "Private DJ"], 
            category: "PRODUCTION",
            img: "/bnt/images/penthouse-party.jpg", 
            inc: "We bring the club to your suite. Includes a pro DJ for 3 hours, premium sound, party lighting, and clean setup/breakdown." 
        },
        { 
            tier: "EXPERIENCE 05 / 14",
            title: "Pool Villa Party", 
            price: "From 4,800 THB / person", 
            pills: ["Private Villa", "DJ Included", "No Curfew"], 
            category: "PRODUCTION",
            img: "/bnt/images/pool-villa-party.jpg", 
            inc: "Luxury villa matching your group size, professional DJ, sound & light setup, and full event hosting." 
        },
        { 
            tier: "EXPERIENCE 06 / 14",
            title: "Rooftop Private Buyout", 
            price: "Pricing on inquiry — submit details for a custom proposal within 4 hours.", 
            pills: ["Skyline Views", "Full Venue", "Custom Budget"], 
            category: "LUXURY",
            img: "/bnt/images/card-rooftop.jpeg", 
            inc: "Complete private buyout of Bangkok’s top rooftop spaces. Full concept setup, guest management, and staffing included." 
        },
        { 
            tier: "EXPERIENCE 07 / 14",
            title: "Brand & Creator Events", 
            price: "Pricing on inquiry — submit details for a custom proposal within 4 hours.", 
            pills: ["Agencies", "Launch Party", "Media Ready"], 
            category: "PRODUCTION",
            img: "/bnt/images/brand-event.jpg", 
            inc: "Access to partner clubs, lighting optimized for content creation, local network activation, and full on-ground event management." 
        },
        { 
            tier: "EXPERIENCE 08 / 14",
            title: "Corporate Night Out", 
            price: "From 1,800 THB / person", 
            pills: ["Companies", "Team Building", "Full Transport"], 
            category: "CELEBRATION",
            img: "/bnt/images/card-corporate.jpeg", 
            inc: "Smooth, safe, and exciting venue itineraries designed for corporate groups. Includes transport, drinks, and full host management." 
        },
        { 
            tier: "EXPERIENCE 09 / 14",
            title: "Surprise Proposal", 
            price: "From 20,000 THB flat", 
            pills: ["Rooftop VIP", "Champagne", "Photographer"], 
            category: "CELEBRATION",
            img: "/bnt/images/proposal.jpg", 
            inc: "Premium rooftop table setup, senior host coordinator, 1 bottle of champagne, flowers, and a hidden photographer." 
        },
        { 
            tier: "EXPERIENCE 10 / 14",
            title: "Anniversary Dinner/Night", 
            price: "From 10,000 THB flat", 
            pills: ["Rooftop Dinner", "Cocktails", "Couples"], 
            category: "CELEBRATION",
            img: "/bnt/images/anniversary.jpg", 
            inc: "Ultra-premium table booking, signature cocktails, fresh flowers at the table, and fully customized planning." 
        },
        { 
            tier: "EXPERIENCE 11 / 14",
            title: "Bachelorette Night", 
            price: "From 2,000 THB / person", 
            pills: ["Girls Night", "VIP Entry", "Party Sprinter"], 
            category: "CELEBRATION",
            img: "/bnt/images/bachelorette-night.jpg", 
            inc: "Tailored premium venue route, private luxury sprinter transport, free welcome shots, hen prop kit, and full hosting." 
        },
        { 
            tier: "EXPERIENCE 12 / 14",
            title: "Bachelor Night Out", 
            price: "From 2,000 THB / person", 
            pills: ["Stag Party", "VIP Transport", "3 Venues"], 
            category: "CELEBRATION",
            img: "/bnt/images/card-bachelor.jpeg", 
            inc: "High-energy 3-club tour, premium party sprinter with sound system, free welcome shots, and a private group host." 
        },
        { 
            tier: "EXPERIENCE 13 / 14",
            title: "Birthday Party", 
            price: "From 2,000 THB / person", 
            pills: ["Celebration", "VIP Access", "Birthday Surprise"], 
            category: "CELEBRATION",
            img: "/bnt/images/birthday-party.jpg", 
            inc: "Curated 2-3 venue tour, express line bypass, private sprinter lounge, welcome shots, and full birthday surprise coordination." 
        },
        { 
            tier: "EXPERIENCE 14 / 14",
            title: "Private Club Crawl", 
            price: "From 1,500 THB / person", 
            pills: ["Private Group", "Line Bypass", "Custom Clubs"], 
            category: "LUXURY",
            img: "/bnt/images/private-club-crawl.jpg", 
            inc: "The ultimate custom Bangkok club tour. Private transport, express skip-the-line club access, welcome shots, and your own host." 
        }
    ];

    const deckContainer = document.getElementById('deck-container');
    const bottomSheetOverlay = document.getElementById('bottom-sheet-overlay');
    const dragHandle = document.getElementById('drag-handle');
    const closeSheet = document.getElementById('close-sheet');
    let currentIndex = 0;

    // Helper to generate a pill HTML string
    const generatePills = (pillsArray) => {
        return pillsArray.map(pill => `<span class="pill">${pill}</span>`).join('');
    };

    // Render the cards dynamically
    experiences.forEach((exp, index) => {
        const card = document.createElement('div');
        card.classList.add('deck-card');
        // Flat layout initialization
        if (index === 0) {
            card.classList.add('deck-card', 'active-card');
            card.style.display = 'block';
            card.style.opacity = '1';
            card.style.zIndex = '5';
        } else {
            card.classList.add('deck-card', 'hidden');
            card.style.display = 'none';
            card.style.opacity = '0';
            card.style.zIndex = '1';
        }
        
        card.dataset.index = index;
        // Fix for missing image fallback
        card.style.backgroundImage = `url('${exp.img || "/bnt/images/hero.jpeg"}')`;

        card.innerHTML = `
            <div class="card-top-bar">
                <div class="tier-pill">${exp.category || "LUXURY"}</div>
                <div class="deck-index-pill">${String(index + 1).padStart(2, '0')} / ${String(experiences.length).padStart(2, '0')}</div>
            </div>
            <div class="card-content">
                <div class="card-bottom">
                    <h3 class="card-title" style="font-weight: 700;">${exp.title}</h3>
                    <div class="pill-container">
                        ${generatePills(exp.pills)}
                    </div>
                    <button class="btn-glow card-cta">VIEW EXPERIENCE →</button>
                </div>
            </div>
        `;
        
        deckContainer.appendChild(card);
    });

    const cards = Array.from(document.querySelectorAll('.deck-card'));

    const updateDeck = () => {
        // Update all deck indicator pills inside each card to match the current count
        document.querySelectorAll('.deck-index-pill').forEach(pill => {
            pill.textContent = `${String(currentIndex + 1).padStart(2, '0')} / ${String(experiences.length).padStart(2, '0')}`;
        });
        
        cards.forEach((card, index) => {
            card.className = 'deck-card'; // Reset classes
            if (index === currentIndex) {
                card.classList.add('active-card');
                card.style.display = 'block';
                card.style.opacity = '1';
                card.style.zIndex = '5';
            } else {
                card.classList.add('hidden');
                card.style.display = 'none';
                card.style.opacity = '0';
                card.style.zIndex = '1';
            }
        });
    };

    const nextCard = () => {
        if (currentIndex < experiences.length - 1) {
            currentIndex++;
            updateDeck();
        } else {
            // Loop back to beginning if desired
            currentIndex = 0;
            updateDeck();
        }
    };

    const prevCard = () => {
        if (currentIndex > 0) {
            currentIndex--;
            updateDeck();
        } else {
            currentIndex = experiences.length - 1;
            updateDeck();
        }
    };

    // Bind navigation chevrons if they exist
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    if (btnPrev && btnNext) {
        btnPrev.addEventListener('click', (e) => {
            e.stopPropagation();
            prevCard();
        });
        btnNext.addEventListener('click', (e) => {
            e.stopPropagation();
            nextCard();
        });
    }

    // Bind mobile navigation buttons
    const btnPrevM = document.getElementById('btn-prev-m');
    const btnNextM = document.getElementById('btn-next-m');
    if (btnPrevM) btnPrevM.addEventListener('click', (e) => { e.stopPropagation(); prevCard(); });
    if (btnNextM) btnNextM.addEventListener('click', (e) => { e.stopPropagation(); nextCard(); });

    // Swipe handling logic for touch screens
    let touchStartX = 0;
    let touchEndX = 0;

    deckContainer.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    }, {passive: true});

    deckContainer.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, {passive: true});

    const handleSwipe = () => {
        if (touchEndX < touchStartX - 50) {
            // Swiped left
            nextCard();
        }
        if (touchEndX > touchStartX + 50) {
            // Swiped right
            prevCard();
        }
    };

    // Click & Drag mouse swipe support for desktop users
    let isDragging = false;
    let dragStartX = 0;

    deckContainer.addEventListener('mousedown', e => {
        // Only trigger if clicking a card itself (not CTA)
        if (e.target.closest('.card-cta')) return;
        isDragging = true;
        dragStartX = e.clientX;
    });

    window.addEventListener('mouseup', e => {
        if (!isDragging) return;
        isDragging = false;
        let dragEndX = e.clientX;
        if (dragEndX < dragStartX - 80) {
            nextCard();
        } else if (dragEndX > dragStartX + 80) {
            prevCard();
        }
    });

    // Intersection Observer for mobile event cards
    const eventCards = document.querySelectorAll('.event-card');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                eventCards.forEach(c => c.classList.remove('active-card'));
                entry.target.classList.add('active-card');
            }
        });
    }, {
        root: null,
        rootMargin: '0px',
        threshold: 0.6
    });
    eventCards.forEach(card => observer.observe(card));

    // Initialize card deck visual layout
    updateDeck();

    // --- NATIVE MULTI-STEP OVERLAY MODAL LOGIC ---
    const modalOverlay = document.getElementById('multi-step-modal-overlay');
    const modalClose = document.getElementById('modal-close');
    const btnFinish = document.getElementById('btn-finish');
    const stepIndicator = document.getElementById('step-indicator');
    
    let currentStep = 1;
    let selectedOccasion = null;

    // Helper: Reset and open modal
    const openModal = (occasionMatch = null) => {
        // Reset all selections
        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        document.querySelectorAll('input[type="text"], input[type="tel"], input[type="date"], textarea').forEach(el => el.value = '');
        document.querySelectorAll('.error-msg').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.error-shake').forEach(el => el.classList.remove('error-shake'));
        document.getElementById('flexible-date').checked = false;
        
        currentStep = 1;
        updateStepView();
        
        // Auto-select occasion based on category if passed
        if (occasionMatch) {
            const items = document.querySelectorAll('.occasion-item');
            items.forEach(item => {
                if (item.dataset.value.toUpperCase() === occasionMatch.toUpperCase()) {
                    item.classList.add('selected');
                    selectedOccasion = item.dataset.value;
                }
            });
            // fallback
            if (!selectedOccasion) {
                items[0].classList.add('selected');
                selectedOccasion = items[0].dataset.value;
            }
        }
        
        modalOverlay.classList.add('active');
    };

    const closeModal = () => {
        modalOverlay.classList.remove('active');
    };

    modalClose.addEventListener('click', closeModal);
    if (btnFinish) btnFinish.addEventListener('click', closeModal);

    // Form element selections
    const addSelectionLogic = (selector, multiple = false) => {
        const container = document.getElementById(selector);
        if (!container) return;
        const children = Array.from(container.querySelectorAll('.occasion-item, .vibe-option, .budget-option, .pill-option, .venue-option'));
        children.forEach(child => {
            child.addEventListener('click', () => {
                if (!multiple) {
                    children.forEach(c => c.classList.remove('selected'));
                }
                child.classList.toggle('selected');
            });
        });
    };

    addSelectionLogic('occasion-stack', false);
    addSelectionLogic('vibe-selector', false);
    addSelectionLogic('budget-selector', false);

    // Track Occasion selection to drive Step 3
    document.getElementById('occasion-stack').addEventListener('click', (e) => {
        const item = e.target.closest('.occasion-item');
        if (item) selectedOccasion = item.dataset.value;
    });

    // Navigation and Validation
    const showError = (elementId) => {
        const el = document.getElementById(elementId) || document.querySelector(`#${elementId}`);
        if(!el) return;
        const parent = el.closest('.input-group') || el.parentElement;
        parent.classList.remove('error-shake');
        void parent.offsetWidth; // trigger reflow
        parent.classList.add('error-shake');
        const errorMsg = parent.querySelector('.error-msg');
        if(errorMsg) errorMsg.style.display = 'block';
    };
    
    const hideError = (elementId) => {
        const el = document.getElementById(elementId) || document.querySelector(`#${elementId}`);
        if(!el) return;
        const parent = el.closest('.input-group') || el.parentElement;
        parent.classList.remove('error-shake');
        const errorMsg = parent.querySelector('.error-msg');
        if(errorMsg) errorMsg.style.display = 'none';
    };

    const validateStep1 = () => {
        let valid = true;
        const name = document.getElementById('guest-name');
        const phone = document.getElementById('guest-phone');
        const occasion = document.querySelector('.occasion-item.selected');
        
        if (!name.value.trim()) { showError('guest-name'); valid = false; } else { hideError('guest-name'); }
        if (!phone.value.trim()) { showError('guest-phone'); valid = false; } else { hideError('guest-phone'); }
        if (!occasion) { showError('occasion-stack'); valid = false; } else { hideError('occasion-stack'); }
        return valid;
    };

    const validateStep2 = () => {
        let valid = true;
        const date = document.getElementById('event-date');
        const flexDate = document.getElementById('flexible-date');
        const pax = document.getElementById('pax-input').value.trim();
        const vibe = document.querySelector('.vibe-option.selected');
        
        if (!date.value && !flexDate.checked) { showError('event-date'); valid = false; } else { hideError('event-date'); }
        if (!pax || isNaN(pax) || parseInt(pax) < 1) { showError('pax-input'); valid = false; } else { hideError('pax-input'); }
        if (!vibe) { showError('vibe-selector'); valid = false; } else { hideError('vibe-selector'); }
        return valid;
    };

    const validateStep3 = () => {
        let valid = true;
        if (selectedOccasion === 'Celebration') {
            const reqVenues = document.getElementById('requested-venues').value.trim();
            const handleVenues = document.getElementById('handle-venue-selection').checked;
            if (!reqVenues && !handleVenues) {
                showError('requested-venues');
                valid = false;
            } else {
                hideError('requested-venues');
            }
        }
        return valid;
    };

    const validateStep4 = () => {
        let valid = true;
        const budget = document.querySelector('.budget-option.selected');
        if (!budget) { showError('budget-selector'); valid = false; } else { hideError('budget-selector'); }
        return valid;
    };

    // Build Dynamic Step 3
    const buildStep3 = () => {
        const content = document.getElementById('step-3-content');
        let html = '';
        if (selectedOccasion === 'Celebration') {
            html = `
                <h2 class="step-title">A FEW MORE DETAILS</h2>
                <p class="step-subtitle">Helps us build the right night for you.</p>
                <div class="input-group">
                    <label>REQUESTED VENUES</label>
                    <textarea id="requested-venues" class="input-field" rows="2" placeholder="Type the venues you prefer..."></textarea>
                    <label class="checkbox-label" style="margin-top: 15px; display: flex; align-items: center; gap: 8px; cursor: pointer; color: white;">
                        <input type="checkbox" id="handle-venue-selection" style="width: auto;"> Please handle venue selection for us
                    </label>
                    <div class="error-msg">Please type a venue or check the box.</div>
                </div>
                <div class="input-group">
                    <label>SPECIAL ADDITIONS</label>
                    <div class="checkbox-list">
                        <label class="checkbox-item"><input type="checkbox"> Cake setup</label>
                        <label class="checkbox-item"><input type="checkbox"> Decor arrays</label>
                        <label class="checkbox-item"><input type="checkbox"> Photographer</label>
                        <label class="checkbox-item"><input type="checkbox"> Dedicated Bottle configurations</label>
                    </div>
                </div>
            `;
        } else if (selectedOccasion === 'Romantic') {
            html = `
                <h2 class="step-title">LET'S MAKE IT PERFECT</h2>
                <p class="step-subtitle">Tell us what matters most.</p>
                <div class="input-group">
                    <label>VENUE SETTING</label>
                    <div class="venue-stack" id="dynamic-venue">
                        <div class="venue-option">Rooftop skyline views</div>
                        <div class="venue-option">Intimate cocktail lounges</div>
                        <div class="venue-option">Premium restaurant bars</div>
                    </div>
                </div>
                <div class="input-group">
                    <label>SPECIAL ENHANCEMENTS</label>
                    <div class="checkbox-list">
                        <label class="checkbox-item"><input type="checkbox"> Flowers at table</label>
                        <label class="checkbox-item"><input type="checkbox"> Staged Champagne</label>
                        <label class="checkbox-item"><input type="checkbox"> Hidden media coverage</label>
                    </div>
                </div>
            `;
        } else if (selectedOccasion === 'Production') {
            html = `
                <h2 class="step-title">LET'S PLAN THE PRODUCTION</h2>
                <p class="step-subtitle">A few details to get your quote right.</p>
                <div class="input-group">
                    <label>VENUE SOURCING</label>
                    <div class="venue-stack" id="dynamic-venue">
                        <div class="venue-option">No - Please source venue asset</div>
                        <div class="venue-option">Yes - I possess the space</div>
                    </div>
                </div>
                <div class="input-group">
                    <label>CORE DELIVERABLES</label>
                    <div class="checkbox-list">
                        <label class="checkbox-item"><input type="checkbox"> Audio/DJ focus</label>
                        <label class="checkbox-item"><input type="checkbox"> Spatial decor layout</label>
                        <label class="checkbox-item"><input type="checkbox"> Photography/Media</label>
                        <label class="checkbox-item"><input type="checkbox"> Catering logistics</label>
                    </div>
                </div>
            `;
        } else {
            // Corporate / Other
            html = `
                <h2 class="step-title">TELL US A BIT MORE</h2>
                <p class="step-subtitle">A quick description helps us tailor your proposal.</p>
                <div class="input-group">
                    <label>EVENT DESCRIPTION</label>
                    <textarea rows="4" placeholder="Tell us about your company, brand, or specific goals for this event..."></textarea>
                </div>
            `;
        }
        content.innerHTML = html;
        if (document.getElementById('dynamic-venue')) {
            addSelectionLogic('dynamic-venue', true); // allow multiple selection
        }
    };

    const updateStepView = () => {
        // Update DOM visibility
        document.querySelectorAll('.modal-step').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.progress-segment').forEach((el, index) => {
            if (index < currentStep) el.classList.add('active');
            else el.classList.remove('active');
        });
        
        if (currentStep <= 4) {
            document.getElementById(`step-${currentStep}`).classList.add('active');
            stepIndicator.innerText = `Step ${currentStep} of 4`;
            document.querySelector('.progress-tracker').style.display = 'flex';
        } else {
            // Success step
            document.getElementById('step-success').classList.add('active');
            stepIndicator.innerText = '';
            document.querySelector('.progress-tracker').style.display = 'none';
        }
    };

    // Navigation Bindings
    document.getElementById('btn-next-1').addEventListener('click', () => {
        if (validateStep1()) {
            buildStep3();
            currentStep = 2; updateStepView();
        }
    });
    document.getElementById('btn-prev-2').addEventListener('click', () => { currentStep = 1; updateStepView(); });
    document.getElementById('btn-next-2').addEventListener('click', () => {
        if (validateStep2()) { currentStep = 3; updateStepView(); }
    });
    document.getElementById('btn-prev-3').addEventListener('click', () => { currentStep = 2; updateStepView(); });
    document.getElementById('btn-next-3').addEventListener('click', () => {
        if (validateStep3()) { currentStep = 4; updateStepView(); }
    });
    document.getElementById('btn-prev-4').addEventListener('click', () => { currentStep = 3; updateStepView(); });
    
    document.getElementById('btn-submit').addEventListener('click', async () => {
        if (!validateStep4()) return;

        const btnSubmit = document.getElementById('btn-submit');
        const originalText = btnSubmit.innerHTML;
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = "Sending Inquiry... ⏳";

        try {
            // Step 1
            const name = document.getElementById('guest-name').value.trim();
            const countryCode = document.getElementById('country-code').value;
            const guestPhone = document.getElementById('guest-phone').value.trim();
            const whatsapp = countryCode + guestPhone;
            const occasion = document.querySelector('.occasion-item.selected')?.dataset.value || 'Celebration';

            // Step 2
            const eventDateInput = document.getElementById('event-date').value;
            const isFlexible = document.getElementById('flexible-date').checked;
            const date = isFlexible ? 'flexible' : eventDateInput;

            const groupSize = document.getElementById('pax-input').value.trim();
            const preferredVibe = document.querySelector('.vibe-option.selected')?.innerText || '';

            // Step 3 (Dynamic Content)
            let step3Info = '';
            if (occasion === 'Celebration') {
                const requestedVenues = document.getElementById('requested-venues')?.value.trim();
                const handleSelection = document.getElementById('handle-venue-selection')?.checked;
                step3Info = `Requested Venues: ${requestedVenues || 'None'}${handleSelection ? ' (Please select for us)' : ''}`;
                
                // Additions
                const additions = Array.from(document.querySelectorAll('#step-3 input[type="checkbox"]:checked'))
                    .map(el => el.parentElement.innerText.trim());
                if (additions.length) {
                    step3Info += ` | Additions: ${additions.join(', ')}`;
                }
            } else if (occasion === 'Romantic' || occasion === 'Production') {
                const settingOptions = Array.from(document.querySelectorAll('#dynamic-venue .venue-option.selected'))
                    .map(el => el.innerText.trim());
                if (settingOptions.length) {
                    step3Info = `Venue Setting: ${settingOptions.join(', ')}`;
                }
                const enhancements = Array.from(document.querySelectorAll('#step-3 input[type="checkbox"]:checked'))
                    .map(el => el.parentElement.innerText.trim());
                if (enhancements.length) {
                    step3Info += (step3Info ? ' | ' : '') + `Enhancements: ${enhancements.join(', ')}`;
                }
            } else {
                const description = document.querySelector('#step-3 textarea')?.value.trim();
                if (description) {
                    step3Info = `Event Description: ${description}`;
                }
            }

            // Step 4
            const budgetRange = document.querySelector('.budget-option.selected')?.innerText || '';
            const additionalNotes = document.getElementById('additional-notes').value.trim();

            // Construct preferred_vibe text to capture everything from Step 2, 3, and 4
            let vibeNotes = `Vibe: ${preferredVibe}`;
            if (step3Info) vibeNotes += `\n${step3Info}`;
            if (additionalNotes) vibeNotes += `\nNotes: ${additionalNotes}`;

            const response = await fetch('/api/vip-inquiry', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    whatsapp,
                    date,
                    groupSize,
                    occasion,
                    preferredVibe: vibeNotes,
                    budgetRange,
                    inquiryType: 'Private Inquiry'
                })
            });

            if (response.ok) {
                currentStep = 5; // Success state
                updateStepView();
            } else {
                const errData = await response.json().catch(() => ({}));
                alert(errData.error || 'Failed to submit inquiry. Please check your connection and try again.');
            }
        } catch (err) {
            console.error('Error submitting form:', err);
            alert('A network error occurred. Please try again.');
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = originalText;
        }
    });

    // Click handler for front card or CTA to open modal
    deckContainer.addEventListener('click', (e) => {
        const clickedCard = e.target.closest('.deck-card');
        if (!clickedCard) return;

        if (clickedCard.classList.contains('front') || e.target.closest('.card-cta')) {
            const idx = clickedCard.dataset.index;
            const category = experiences[idx].category;
            // Map category to occasion
            let occ = 'Celebration';
            if(category === 'PRODUCTION') occ = 'Production';
            if(category === 'LUXURY') occ = 'Celebration';
            if(category === 'CELEBRATION') occ = 'Celebration';
            openModal(occ);
        } else if (clickedCard.classList.contains('middle')) {
            nextCard();
        }
    });
    
    // Global Nav Logic
    const hamburger = document.getElementById('hamburger-btn');
    const drawer = document.getElementById('nav-drawer');
    const overlay = document.getElementById('nav-overlay');
    const closeDrawer = document.getElementById('close-drawer');
    if (hamburger && drawer && overlay && closeDrawer) {
        const openNav = () => {
            drawer.classList.add('open');
            overlay.classList.add('open');
        };
        const closeNav = () => {
            drawer.classList.remove('open');
            overlay.classList.remove('open');
        };
        hamburger.addEventListener('click', openNav);
        closeDrawer.addEventListener('click', closeNav);
        overlay.addEventListener('click', closeNav);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLuxuryLanding);
} else {
    initLuxuryLanding();
}
