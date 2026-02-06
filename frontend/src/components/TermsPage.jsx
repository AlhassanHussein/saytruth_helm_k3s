import { useNavigate } from 'react-router-dom';
import { translations } from '../i18n/translations';
import './TermsPage.css';

const TermsPage = ({ language = 'EN' }) => {
    const navigate = useNavigate();
    const t = translations[language] || translations.EN;
    const terms = t.terms || translations.EN.terms;
    const isRTL = language === 'AR';

    return (
        <div className={`terms-page ${isRTL ? 'rtl' : ''}`}>
            <section className="terms-card">
                <button className="terms-back" type="button" onClick={() => navigate(-1)}>
                    ← {terms.back}
                </button>
                <h1 className="terms-title">{terms.title}</h1>
                <p className="terms-subtitle">{terms.subtitle}</p>
                <div className="terms-updated">{terms.updated}</div>

                <div className="terms-section">
                    <h3>{terms.sections.acceptance}</h3>
                    <p>{terms.body.acceptance}</p>
                </div>
                <div className="terms-section">
                    <h3>{terms.sections.usage}</h3>
                    <p>{terms.body.usage}</p>
                </div>
                <div className="terms-section">
                    <h3>{terms.sections.content}</h3>
                    <p>{terms.body.content}</p>
                </div>
                <div className="terms-section">
                    <h3>{terms.sections.privacy}</h3>
                    <p>{terms.body.privacy}</p>
                </div>
                <div className="terms-section">
                    <h3>{terms.sections.changes}</h3>
                    <p>{terms.body.changes}</p>
                </div>
            </section>
        </div>
    );
};

export default TermsPage;
