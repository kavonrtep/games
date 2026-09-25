/**
 * HMM EXPLORER – page controller
 * ==============================
 * Tabs, step pills, side-panel switching and deep links (#basics-4,
 * #pair-2, #profile-7, #quiz) for hmm.html.
 */
class HmmApp {
    constructor() {
        this.$ = id => document.getElementById(id);
        this.parts = {};
        this.parts.basics = new HmmBasics(this);
        this.parts.pair = new HmmPair(this);
        this.parts.profile = new HmmProfile(this);
        this.quiz = new HmmQuiz(this);

        document.querySelectorAll('.bl-tab').forEach(b => b.addEventListener('click', () => this.showTab(b.dataset.tab)));
        document.querySelectorAll('.bl-steps').forEach(box => box.addEventListener('click', e => {
            const b = e.target.closest('.bl-step');
            if (b) this.go(box.dataset.part, +b.dataset.step);
        }));
        document.querySelectorAll('.step-prev').forEach(b => b.addEventListener('click', () => this.go(b.dataset.part, this.parts[b.dataset.part].step - 1)));
        document.querySelectorAll('.step-next').forEach(b => b.addEventListener('click', () => this.go(b.dataset.part, this.parts[b.dataset.part].step + 1)));
        window.addEventListener('hashchange', () => this.fromHash());
        this.fromHash();
    }

    fromHash() {
        const m = /^#(basics|pair|profile|quiz)(?:-(\d+))?$/.exec(location.hash);
        if (!m) { this.showTab('basics', false); return; }
        this.showTab(m[1], false);
        if (m[2] && this.parts[m[1]]) this.parts[m[1]].showStep(+m[2]);
    }

    showTab(tab, updateHash = true) {
        this.tab = tab;
        document.querySelectorAll('.bl-tab').forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
        ['basics', 'pair', 'profile', 'quiz'].forEach(t => { this.$('tab-' + t).hidden = t !== tab; });
        document.querySelectorAll('.side-panel [data-for]').forEach(s => { s.hidden = s.dataset.for !== tab; });
        if (tab === 'quiz') this.quiz.ensure();
        else this.parts[tab].showStep(this.parts[tab].step);
        if (updateHash) this.setHash();
    }

    go(part, step) {
        this.parts[part].showStep(step);
        this.setHash();
        const top = this.$('tab-' + part).getBoundingClientRect().top;
        if (top < 0) window.scrollBy({ top: top - 10, behavior: 'smooth' });
    }

    setHash() {
        const h = this.tab === 'quiz' ? '#quiz' : `#${this.tab}-${this.parts[this.tab].step}`;
        if (location.hash !== h) history.replaceState(null, '', h);
    }

    setPills(part, step) {
        document.querySelectorAll(`.bl-steps[data-part="${part}"] .bl-step`).forEach(b => b.classList.toggle('active', +b.dataset.step === step));
        const prev = document.querySelector(`.step-prev[data-part="${part}"]`), next = document.querySelector(`.step-next[data-part="${part}"]`);
        const n = document.querySelectorAll(`.bl-steps[data-part="${part}"] .bl-step`).length;
        if (prev) prev.disabled = step <= 1;
        if (next) next.disabled = step >= n;
    }

    toast(message, type = 'info') {
        const el = document.createElement('div');
        el.className = `notification notification-${type} show`; el.textContent = message;
        this.$('toast-stack').appendChild(el);
        setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3500);
    }
}

(function () {
    const start = () => { window.hmmApp = new HmmApp(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
