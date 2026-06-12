'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// Vendor CSS
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'aos/dist/aos.css';
import 'glightbox/dist/css/glightbox.min.css';
import 'swiper/css/bundle';

// Landing CSS
import './Home.css';

// Images
const heroBg = '/assets/hero-bg.jpg';
const ctaBg = '/assets/cta-bg.jpg';
const featuresBg = '/assets/features-bg.jpg';
const statsBg = '/assets/stats-bg.jpg';
const logoImg = '/assets/logo.png';

const LandingPage = () => {
    const rootRef = useRef(null);
    const [contactStatus, setContactStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });

    useEffect(() => {
        let cleanup = null;
        const timer = setTimeout(async () => {
            if (typeof window !== 'undefined') {
                const { initLanding, cleanupLanding } = await import('./landingInit');
                await initLanding(rootRef.current);
                cleanup = cleanupLanding;
            }
        }, 100);

        return () => {
            clearTimeout(timer);
            if (cleanup) cleanup();
        };
    }, []);

    return (
        <div className="landing-page index-page" ref={rootRef}>
            {/* ========== HEADER ========== */}
            <header id="header" className="header d-flex align-items-center fixed-top">
                <div className="container position-relative d-flex align-items-center justify-content-between">
                    <a href="#hero" className="logo d-flex align-items-center me-auto me-xl-0">
                        <img src={logoImg} alt="REBot Logo" />
                        <h1 className="sitename">REBot</h1>
                    </a>

                    <nav id="navmenu" className="navmenu">
                        <ul>
                            <li><a href="#hero" className="active">Trang chủ</a></li>
                            <li><a href="#about">Giới thiệu</a></li>
                            <li><a href="#services">Tính năng</a></li>
                            <li><a href="#team">Nhóm phát triển</a></li>
                            <li><a href="#contact">Liên hệ</a></li>
                        </ul>
                        <i className="mobile-nav-toggle d-xl-none bi bi-list"></i>
                    </nav>

                    <Link className="cta-btn" href="/auth">Dành cho Quản trị viên</Link>
                </div>
            </header>

            {/* ========== MAIN ========== */}
            <main className="main">

                {/* Hero Section */}
                <section id="hero" className="hero section dark-background">
                    <img src={heroBg} alt="" data-aos="fade-in" />
                    <div className="container d-flex flex-column align-items-center text-center">
                        <h2 data-aos="fade-up" data-aos-delay="100">REBot</h2>
                        <p data-aos="fade-up" data-aos-delay="200">
                            Hỗ trợ tra cứu và tư vấn quy chế đào tạo Đại học Cần Thơ<br />
                            một cách chính xác, nhanh chóng và liên tục 24/7
                        </p>
                        <div data-aos="fade-up" data-aos-delay="300">
                            <Link href="/chat" className="pulsating-play-btn"></Link>
                        </div>
                    </div>
                </section>

                {/* About Section */}
                <section id="about" className="about section">
                    <div className="container section-title" data-aos="fade-up">
                        <h2>Về REBot</h2>
                        <p>Trợ lý ảo hỗ trợ tra cứu thông tin học vụ</p>
                    </div>
                    <div className="container">
                        <div className="row gy-4 justify-content-center">
                            <div className="col-lg-6 content" data-aos="fade-up" data-aos-delay="100">
                                <p>
                                    REBot là trợ lý học vụ thông minh do đội ngũ sinh viên Đại học Cần Thơ phát triển,
                                    với mục tiêu hỗ trợ tự động trong việc tra cứu và giải đáp các vấn đề liên quan đến:
                                </p>
                                <ul>
                                    <li><i className="bi bi-check2-circle"></i> <span>Quy chế đào tạo và điều kiện tốt nghiệp</span></li>
                                    <li><i className="bi bi-check2-circle"></i> <span>Học tập, rèn luyện và quy định ký túc xá</span></li>
                                    <li><i className="bi bi-check2-circle"></i> <span>Chính sách khen thưởng và xử lý kỷ luật</span></li>
                                </ul>
                            </div>
                            <div className="col-lg-6 d-flex align-items-center justify-content-center" data-aos="fade-up" data-aos-delay="200" id="rebot-animation"></div>
                        </div>
                    </div>
                </section>

                {/* Services Section */}
                <section id="services" className="services section">
                    <div className="container section-title" data-aos="fade-up">
                        <h2>Tính năng nổi bật</h2>
                        <p>Những tiện ích REBot mang lại cho sinh viên</p>
                    </div>
                    <div className="container">
                        <div className="row gy-4 justify-content-center">

                            <div className="col-lg-6 col-md-6" data-aos="fade-up" data-aos-delay="100">
                                <div className="service-item">
                                    <div className="icon"><i className="bi bi-search"></i></div>
                                    <h3>Tra cứu thông minh</h3>
                                    <p>Dễ dàng tra cứu quy chế đào tạo, điều kiện tốt nghiệp, ký túc xá và các thông tin học vụ chỉ bằng cách đặt câu hỏi.</p>
                                </div>
                            </div>

                            <div className="col-lg-6 col-md-6" data-aos="fade-up" data-aos-delay="200">
                                <div className="service-item">
                                    <div className="icon"><i className="bi bi-lightning-charge"></i></div>
                                    <h3>Phản hồi nhanh và chính xác</h3>
                                    <p>REBot sử dụng AI để hiểu ngữ cảnh và trả lời chính xác, giúp tiết kiệm thời gian và tránh hiểu nhầm thông tin.</p>
                                </div>
                            </div>

                            <div className="col-lg-6 col-md-6" data-aos="fade-up" data-aos-delay="300">
                                <div className="service-item">
                                    <div className="icon"><i className="bi bi-ui-checks-grid"></i></div>
                                    <h3>Giao diện thân thiện</h3>
                                    <p>Thiết kế đơn giản, dễ sử dụng với giao diện trò chuyện trực quan, phù hợp cả với người không rành công nghệ.</p>
                                </div>
                            </div>

                            <div className="col-lg-6 col-md-6" data-aos="fade-up" data-aos-delay="400">
                                <div className="service-item">
                                    <div className="icon"><i className="bi bi-shield-check"></i></div>
                                    <h3>Thông tin đáng tin cậy</h3>
                                    <p>Dữ liệu được cập nhật từ các nguồn chính thống của Đại học Cần Thơ, đảm bảo độ chính xác và tin cậy.</p>
                                </div>
                            </div>

                        </div>
                    </div>
                </section>

                {/* Team Section */}
                <section id="team" className="team section">
                    <div className="container section-title" data-aos="fade-up">
                        <h2>Nhóm phát triển</h2>
                        <p>Đội ngũ sinh viên Đại học Cần Thơ</p>
                    </div>
                    <div className="container">
                        <div className="row gy-4 justify-content-center">

                            <div className="col-lg-4 col-md-6" data-aos="fade-up" data-aos-delay="100">
                                <div className="team-member text-center">
                                    <h4>TS. Mã Trường Thành</h4>
                                    <div className="underline"></div>
                                    <span><em>Cán bộ hướng dẫn</em></span>
                                    <div className="social mt-3">
                                        <a href="#"><i className="bi bi-twitter"></i></a>
                                        <a href="#"><i className="bi bi-facebook"></i></a>
                                        <a href="#"><i className="bi bi-instagram"></i></a>
                                        <a href="#"><i className="bi bi-linkedin"></i></a>
                                    </div>
                                </div>
                            </div>

                            <div className="col-lg-4 col-md-6" data-aos="fade-up" data-aos-delay="200">
                                <div className="team-member text-center">
                                    <h4>La Trí Tâm</h4>
                                    <div className="underline"></div>
                                    <span><em>Thành viên chính</em></span>
                                    <div className="social mt-3">
                                        <a href="#"><i className="bi bi-twitter"></i></a>
                                        <a href="#"><i className="bi bi-facebook"></i></a>
                                        <a href="#"><i className="bi bi-instagram"></i></a>
                                        <a href="#"><i className="bi bi-linkedin"></i></a>
                                    </div>
                                </div>
                            </div>

                            <div className="col-lg-4 col-md-6" data-aos="fade-up" data-aos-delay="300">
                                <div className="team-member text-center">
                                    <h4>Nguyễn Minh Nghi</h4>
                                    <div className="underline"></div>
                                    <span><em>Thành viên chính</em></span>
                                    <div className="social mt-3">
                                        <a href="#"><i className="bi bi-twitter"></i></a>
                                        <a href="#"><i className="bi bi-facebook"></i></a>
                                        <a href="#"><i className="bi bi-instagram"></i></a>
                                        <a href="#"><i className="bi bi-linkedin"></i></a>
                                    </div>
                                </div>
                            </div>

                            <div className="col-lg-4 col-md-6" data-aos="fade-up" data-aos-delay="400">
                                <div className="team-member text-center">
                                    <h4>Phạm Lưu Khánh Vân</h4>
                                    <div className="underline"></div>
                                    <span><em>Thành viên chính</em></span>
                                    <div className="social mt-3">
                                        <a href="#"><i className="bi bi-twitter"></i></a>
                                        <a href="#"><i className="bi bi-facebook"></i></a>
                                        <a href="#"><i className="bi bi-instagram"></i></a>
                                        <a href="#"><i className="bi bi-linkedin"></i></a>
                                    </div>
                                </div>
                            </div>

                            <div className="col-lg-4 col-md-6" data-aos="fade-up" data-aos-delay="500">
                                <div className="team-member text-center">
                                    <h4>Lê Hữu Lâm Thư</h4>
                                    <div className="underline"></div>
                                    <span><em>Thành viên chính</em></span>
                                    <div className="social mt-3">
                                        <a href="#"><i className="bi bi-twitter"></i></a>
                                        <a href="#"><i className="bi bi-facebook"></i></a>
                                        <a href="#"><i className="bi bi-instagram"></i></a>
                                        <a href="#"><i className="bi bi-linkedin"></i></a>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </section>

                {/* Expert Verification Section */}
                <section id="expert-verification" className="expert-verification section light-background">
                    <div className="container section-title" data-aos="fade-up">
                        <h2>Kiểm chứng từ chuyên gia</h2>
                        <p>Các chuyên gia xác thực độ tin cậy của REBot</p>
                    </div>
                    <div className="container">
                        <div className="row gy-4 justify-content-center">

                            <div className="col-lg-4 col-md-6" data-aos="fade-up" data-aos-delay="100">
                                <div className="expert-member text-center">
                                    <h4>TS. Trần Việt Châu</h4>
                                    <div className="underline"></div>
                                    <span><em>Chuyên gia xác thực</em></span>
                                </div>
                            </div>

                            <div className="col-lg-4 col-md-6" data-aos="fade-up" data-aos-delay="200">
                                <div className="expert-member text-center">
                                    <h4>Lương Thị Huyền Trân</h4>
                                    <div className="underline"></div>
                                    <span><em>Chuyên gia xác thực</em></span>
                                </div>
                            </div>

                        </div>
                    </div>
                </section>

                {/* Call To Action Section */}
                <section id="call-to-action" className="call-to-action section dark-background">
                    <img src={ctaBg} alt="" />
                    <div className="container">
                        <div className="row" data-aos="zoom-in" data-aos-delay="100">
                            <div className="col-xl-9 text-center text-xl-start">
                                <h3>Sẵn sàng trải nghiệm?</h3>
                                <p>Hãy bắt đầu trò chuyện với REBot ngay hôm nay để được hỗ trợ tốt nhất!</p>
                            </div>
                            <div className="col-xl-3 cta-btn-container text-center">
                                <Link className="cta-btn align-middle" href="/chat">Trải nghiệm ngay</Link>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section id="features" className="features section">
                    <div className="container">
                        <div className="row gy-4">
                            <div className="features-image col-lg-6 order-lg-2" data-aos="fade-up" data-aos-delay="100">
                                <img src={featuresBg} alt="" />
                            </div>
                            <div className="col-lg-6 order-lg-1">

                                <div className="features-item d-flex ps-0 ps-lg-3 pt-4 pt-lg-0" data-aos="fade-up" data-aos-delay="200">
                                    <i className="bi bi-journal-bookmark-fill flex-shrink-0"></i>
                                    <div>
                                        <h4>Cơ sở dữ liệu đầy đủ</h4>
                                        <p>Tích hợp toàn bộ quy chế đào tạo mới nhất của trường</p>
                                    </div>
                                </div>

                                <div className="features-item d-flex mt-5 ps-0 ps-lg-3" data-aos="fade-up" data-aos-delay="300">
                                    <i className="bi bi-cpu-fill flex-shrink-0"></i>
                                    <div>
                                        <h4>Công nghệ AI tiên tiến</h4>
                                        <p>Hiểu ngữ cảnh và cải thiện qua từng tương tác</p>
                                    </div>
                                </div>

                                <div className="features-item d-flex mt-5 ps-0 ps-lg-3" data-aos="fade-up" data-aos-delay="400">
                                    <i className="bi bi-shield-lock-fill flex-shrink-0"></i>
                                    <div>
                                        <h4>Bảo mật thông tin</h4>
                                        <p>Cam kết không lưu trữ dữ liệu cá nhân người dùng</p>
                                    </div>
                                </div>

                                <div className="features-item d-flex mt-5 ps-0 ps-lg-3" data-aos="fade-up" data-aos-delay="500">
                                    <i className="bi bi-cloud-arrow-up-fill flex-shrink-0"></i>
                                    <div>
                                        <h4>Cập nhật liên tục</h4>
                                        <p>Tự động cập nhật khi có thay đổi quy chế</p>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </section>

                {/* Stats Section */}
                <section id="stats" className="stats section dark-background">
                    <img src={statsBg} alt="" data-aos="fade-in" />
                    <div className="container position-relative" data-aos="fade-up" data-aos-delay="100">
                        <div className="subheading">
                            <h3>Trải nghiệm ấn tượng</h3>
                            <p>Những con số đạt được từ khi ra mắt</p>
                        </div>
                        <div className="row gy-4 justify-content-center">

                            <div className="col-lg-3 col-md-6">
                                <div className="stats-item text-center w-100 h-100">
                                    <span data-purecounter-start="0" data-purecounter-end="232" data-purecounter-duration="1" className="purecounter"></span>
                                    <p>Lượt truy cập</p>
                                </div>
                            </div>

                            <div className="col-lg-3 col-md-6">
                                <div className="stats-item text-center w-100 h-100">
                                    <span data-purecounter-start="0" data-purecounter-end="521" data-purecounter-duration="1" className="purecounter"></span>
                                    <p>Câu hỏi đã xử lý</p>
                                </div>
                            </div>

                            <div className="col-lg-3 col-md-6">
                                <div className="stats-item text-center w-100 h-100">
                                    <span data-purecounter-start="0" data-purecounter-end="830" data-purecounter-duration="1" className="purecounter"></span>
                                    <p>Số giờ phát triển</p>
                                </div>
                            </div>

                        </div>
                    </div>
                </section>

                {/* FAQ Section */}
                <section id="faq" className="faq section">
                    <div className="container">
                        <div className="row gy-4 justify-content-center">
                            <div className="col-lg-10 d-flex flex-column justify-content-center">
                                <div className="content" data-aos="fade-up" data-aos-delay="100">
                                    <h3><span>Câu hỏi </span><strong>Thường gặp</strong></h3>
                                    <p>Tổng hợp những thắc mắc phổ biến khi sử dụng REBot</p>
                                </div>
                                <div className="faq-container" data-aos="fade-up" data-aos-delay="200">

                                    <div className="faq-item faq-active">
                                        <i className="faq-icon bi bi-question-circle"></i>
                                        <h3>Cách sử dụng REBot như thế nào?</h3>
                                        <div className="faq-content">
                                            <p>Chỉ cần nhập câu hỏi vào khung chat, REBot sẽ tự động phân tích và đưa ra câu trả lời phù hợp nhất từ cơ sở dữ liệu.</p>
                                        </div>
                                        <i className="faq-toggle bi bi-chevron-right"></i>
                                    </div>

                                    <div className="faq-item">
                                        <i className="faq-icon bi bi-question-circle"></i>
                                        <h3>REBot có miễn phí không?</h3>
                                        <div className="faq-content">
                                            <p>REBot hoàn toàn miễn phí cho sinh viên và giảng viên Đại học Cần Thơ.</p>
                                        </div>
                                        <i className="faq-toggle bi bi-chevron-right"></i>
                                    </div>

                                    <div className="faq-item">
                                        <i className="faq-icon bi bi-question-circle"></i>
                                        <h3>REBot có thể tư vấn những thông tin nào?</h3>
                                        <div className="faq-content">
                                            <p>
                                                REBot hỗ trợ tư vấn toàn diện về quy chế đào tạo, học tập - rèn luyện, ký túc xá, chính sách khen thưởng - kỷ luật và
                                                nhiều vấn đề khác mà sinh viên thường quan tâm.
                                            </p>
                                        </div>
                                        <i className="faq-toggle bi bi-chevron-right"></i>
                                    </div>

                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Contact Section */}
                <section id="contact" className="contact section light-background">
                    <div className="container section-title" data-aos="fade-up">
                        <h2>Liên hệ</h2>
                        <p>Kết nối với chúng tôi</p>
                    </div>
                    <div className="container" data-aos="fade" data-aos-delay="100">
                        <div className="row gy-4">

                            <div className="col-lg-4">
                                <div className="info-item d-flex" data-aos="fade-up" data-aos-delay="200">
                                    <i className="bi bi-geo-alt flex-shrink-0"></i>
                                    <div>
                                        <h3>Địa chỉ</h3>
                                        <p>Khu II, Đ. 3/2, Xuân Khánh, Ninh Kiều, Cần Thơ</p>
                                    </div>
                                </div>
                                <div className="info-item d-flex" data-aos="fade-up" data-aos-delay="300">
                                    <i className="bi bi-telephone flex-shrink-0"></i>
                                    <div>
                                        <h3>Điện thoại</h3>
                                        <p>(84-123) 456789</p>
                                    </div>
                                </div>
                                <div className="info-item d-flex" data-aos="fade-up" data-aos-delay="400">
                                    <i className="bi bi-envelope flex-shrink-0"></i>
                                    <div>
                                        <h3>Email</h3>
                                        <p>rebot@ctu.edu.vn</p>
                                    </div>
                                </div>
                            </div>

                            <div className="col-lg-8">
                                <form
                                    className="php-email-form"
                                    data-aos="fade-up"
                                    data-aos-delay="200"
                                    onSubmit={async e => {
                                        e.preventDefault();
                                        if (contactStatus === 'loading') return;
                                        setContactStatus('loading');
                                        try {
                                            const res = await fetch('/api/contact', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify(contactForm),
                                            });
                                            if (res.ok) {
                                                setContactStatus('success');
                                                setContactForm({ name: '', email: '', subject: '', message: '' });
                                            } else {
                                                setContactStatus('error');
                                            }
                                        } catch {
                                            setContactStatus('error');
                                        }
                                    }}
                                >
                                    <div className="row gy-4">
                                        <div className="col-md-6">
                                            <input
                                                type="text"
                                                name="name"
                                                className="form-control"
                                                placeholder="Họ và tên"
                                                required
                                                value={contactForm.name}
                                                onChange={e => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                                            />
                                        </div>
                                        <div className="col-md-6">
                                            <input
                                                type="email"
                                                className="form-control"
                                                name="email"
                                                placeholder="Địa chỉ Email"
                                                required
                                                value={contactForm.email}
                                                onChange={e => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                                            />
                                        </div>
                                        <div className="col-md-12">
                                            <input
                                                type="text"
                                                className="form-control"
                                                name="subject"
                                                placeholder="Tiêu đề"
                                                required
                                                value={contactForm.subject}
                                                onChange={e => setContactForm(prev => ({ ...prev, subject: e.target.value }))}
                                            />
                                        </div>
                                        <div className="col-md-12">
                                            <textarea
                                                className="form-control"
                                                name="message"
                                                rows={6}
                                                placeholder="Nội dung"
                                                required
                                                value={contactForm.message}
                                                onChange={e => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                                            ></textarea>
                                        </div>
                                        <div className="col-md-12 text-center">
                                            {contactStatus === 'loading' && (
                                                <div className="loading">Đang tải</div>
                                            )}
                                            {contactStatus === 'error' && (
                                                <div className="error-message">Gửi tin nhắn thất bại. Vui lòng thử lại sau.</div>
                                            )}
                                            {contactStatus === 'success' && (
                                                <div className="sent-message">Tin nhắn đã được gửi. Cảm ơn bạn!</div>
                                            )}
                                            <button type="submit" disabled={contactStatus === 'loading'}>
                                                {contactStatus === 'loading' ? 'Đang gửi...' : 'Gửi'}
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>

                        </div>
                    </div>
                </section>

            </main>

            {/* ========== FOOTER ========== */}
            <footer className="footer">
                <div className="container">
                    <div className="row gy-4">

                        <div className="col-lg-4 col-md-6 footer-contact">
                            <img src="https://www.ctu.edu.vn/images/Asset_45logomobile.png" alt="CTU Logo" className="footer-logo mb-3" />
                            <p><i className="bi bi-geo-alt-fill me-2"></i>Khu II, Đ. 3/2, Xuân Khánh, Ninh Kiều, Cần Thơ</p>
                            <p><i className="bi bi-telephone-fill me-2"></i>(84-292) 3832663</p>
                            <p><i className="bi bi-envelope-fill me-2"></i> <a href="mailto:dhct@ctu.edu.vn">dhct@ctu.edu.vn</a></p>
                        </div>

                        <div className="col-lg-3 offset-lg-1 col-md-6 footer-links">
                            <h4>DỊCH VỤ VÀ THÔNG TIN</h4>
                            <ul>
                                <li><a href="#">Trang Chủ</a></li>
                                <li><a href="#about">Giới thiệu</a></li>
                                <li><a href="#faq">FAQ</a></li>
                                <li><a href="#contact">Liên hệ</a></li>
                            </ul>
                        </div>

                        <div className="col-lg-3 offset-lg-1 col-md-6 footer-social">
                            <h4>KẾT NỐI VỚI CHÚNG TÔI</h4>
                            <div className="social-links mt-3">
                                <a href="#"><i className="bi bi-facebook"></i></a>
                                <a href="#"><i className="bi bi-youtube"></i></a>
                                <a href="#"><i className="bi bi-instagram"></i></a>
                                <a href="#"><i className="bi bi-linkedin"></i></a>
                            </div>
                        </div>

                    </div>
                </div>
            </footer>

            {/* Scroll Top */}
            <a href="#" id="scroll-top" className="scroll-top d-flex align-items-center justify-content-center">
                <i className="bi bi-arrow-up-short"></i>
            </a>

            {/* Preloader */}
            <div id="preloader"></div>
        </div>
    );
};

export default LandingPage;
