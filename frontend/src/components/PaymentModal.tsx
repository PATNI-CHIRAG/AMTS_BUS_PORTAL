import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  CreditCard,
  QrCode,
  Building2,
  Wallet,
  CheckCircle2,
  Lock,
  ArrowRight,
  Smartphone,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { QRCodeSVG } from '../utils/qrCode';

export type PaymentMethodType = 'upi_qr' | 'upi_id' | 'card' | 'netbanking' | 'smart_card';

export interface PaymentDetails {
  methodName: string;
  transactionId: string;
  amount: number;
  paidAt: string;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  passengerName: string;
  ticketDescription: string;
  busFleet: string;
  onPaymentSuccess: (details: PaymentDetails) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  amount,
  passengerName,
  ticketDescription,
  busFleet,
  onPaymentSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<PaymentMethodType>('upi_qr');

  // Form inputs
  const [upiId, setUpiId] = useState<string>('');
  const [cardNumber, setCardNumber] = useState<string>('4532 •••• •••• 8821');
  const [cardHolder, setCardHolder] = useState<string>(passengerName || 'Hasmukh Patel');
  const [cardExpiry, setCardExpiry] = useState<string>('08/29');
  const [cardCvv, setCardCvv] = useState<string>('832');
  const [selectedBank, setSelectedBank] = useState<string>('State Bank of India (SBI)');
  const [smartCardId, setSmartCardId] = useState<string>('AMTS-JAN-8842-1920');

  // Gateway Simulation States: 'form' | 'processing' | 'success'
  const [gatewayState, setGatewayState] = useState<'form' | 'processing' | 'success'>('form');
  const [processingStep, setProcessingStep] = useState<string>('');
  const [txId, setTxId] = useState<string>('');
  const [methodName, setMethodName] = useState<string>('');

  // Countdown for UPI QR
  const [qrTimer, setQrTimer] = useState<number>(299);

  useEffect(() => {
    if (!isOpen) {
      setGatewayState('form');
      setQrTimer(299);
      return;
    }
    const timer = setInterval(() => {
      setQrTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStartPayment = (selectedMethodName: string) => {
    const generatedTxId = `TXN-AMTS-${Date.now().toString().slice(-8)}-${Math.floor(1000 + Math.random() * 9000)}`;
    setTxId(generatedTxId);
    setMethodName(selectedMethodName);
    setGatewayState('processing');
    setProcessingStep('Connecting to Secure Payment Gateway (NPCI / RBI)...');

    setTimeout(() => {
      setProcessingStep('Authorizing and Verifying Account Token...');
    }, 1000);

    setTimeout(() => {
      setProcessingStep('Transaction Approved by Bank!');
      setGatewayState('success');
    }, 2200);

    setTimeout(() => {
      onPaymentSuccess({
        methodName: selectedMethodName,
        transactionId: generatedTxId,
        amount,
        paidAt: new Date().toISOString(),
      });
    }, 3400);
  };

  return (
    <div className="modal-backdrop payment-modal-backdrop">
      <div className="payment-checkout-card">
        <div className="sheet-drag-pill"></div>
        {/* Header */}
        <div className="payment-header">
          <div className="payment-brand-box">
            <div className="payment-logo-badge">
              <ShieldCheck size={20} className="text-emerald" />
            </div>
            <div>
              <h3 className="payment-brand-title">AMTS SafePay Gateway</h3>
              <p className="payment-brand-sub">Government of Gujarat • Official Transit Portal</p>
            </div>
          </div>
          {gatewayState === 'form' && (
            <button type="button" className="close-btn" onClick={onClose} title="Cancel Payment">
              <X size={18} />
            </button>
          )}
        </div>

        {/* ORDER SUMMARY STRIP */}
        <div className="payment-order-strip">
          <div className="order-item-left">
            <span className="order-product-name">{ticketDescription}</span>
            <span className="order-passenger-meta">
              Passenger: <strong>{passengerName}</strong> • Bus: <strong>{busFleet}</strong>
            </span>
          </div>
          <div className="order-price-right">
            <span className="order-amount-label">Amount Payable:</span>
            <span className="order-amount-val">₹{amount}</span>
          </div>
        </div>

        {/* GATEWAY STATE: FORM */}
        {gatewayState === 'form' && (
          <div className="payment-body">
            {/* Payment Method Selector Tabs */}
            <div className="payment-tabs-bar">
              <button
                type="button"
                className={`payment-tab-btn ${activeTab === 'upi_qr' ? 'active' : ''}`}
                onClick={() => setActiveTab('upi_qr')}
              >
                <QrCode size={15} />
                <span>UPI QR Code</span>
              </button>

              <button
                type="button"
                className={`payment-tab-btn ${activeTab === 'upi_id' ? 'active' : ''}`}
                onClick={() => setActiveTab('upi_id')}
              >
                <Smartphone size={15} />
                <span>UPI ID / VPA</span>
              </button>

              <button
                type="button"
                className={`payment-tab-btn ${activeTab === 'card' ? 'active' : ''}`}
                onClick={() => setActiveTab('card')}
              >
                <CreditCard size={15} />
                <span>Card (Debit/Credit)</span>
              </button>

              <button
                type="button"
                className={`payment-tab-btn ${activeTab === 'netbanking' ? 'active' : ''}`}
                onClick={() => setActiveTab('netbanking')}
              >
                <Building2 size={15} />
                <span>Net Banking</span>
              </button>

              <button
                type="button"
                className={`payment-tab-btn ${activeTab === 'smart_card' ? 'active' : ''}`}
                onClick={() => setActiveTab('smart_card')}
              >
                <Wallet size={15} />
                <span>AMTS Janmitra</span>
              </button>
            </div>

            {/* TAB 1: UPI QR CODE */}
            {activeTab === 'upi_qr' && (
              <div className="tab-pane upi-qr-pane">
                <div className="qr-scan-wrapper">
                  <div className="qr-frame">
                    <QRCodeSVG
                      value={`upi://pay?pa=amts.transit@sbi&pn=AMTS_Ahmedabad&am=${amount}.00&cu=INR&tn=AMTS_TICKET_${busFleet}`}
                      size={160}
                    />
                  </div>
                  <div className="qr-scan-instructions">
                    <div className="qr-title">Scan QR code using any UPI App</div>
                    <div className="upi-apps-badges">
                      <span className="upi-app gpay">GPay</span>
                      <span className="upi-app phonepe">PhonePe</span>
                      <span className="upi-app paytm">Paytm</span>
                      <span className="upi-app bhim">BHIM UPI</span>
                    </div>
                    <div className="qr-countdown-text">
                      <Clock size={12} />
                      <span>Code expires in <strong>{formatTimer(qrTimer)}</strong></span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-pay-now upi-btn"
                  onClick={() => handleStartPayment('UPI / QR Scan (Google Pay / PhonePe)')}
                >
                  <Lock size={15} />
                  <span>I have scanned & paid ₹{amount}</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            )}

            {/* TAB 2: UPI ID */}
            {activeTab === 'upi_id' && (
              <div className="tab-pane upi-id-pane">
                <div className="form-group">
                  <label className="form-label">Enter Virtual Payment Address (UPI ID)</label>
                  <div className="input-with-suffix">
                    <input
                      type="text"
                      className="form-input font-mono"
                      placeholder="e.g. 9876543210@upi or yourname@okhdfcbank"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                    />
                  </div>
                  <span className="helper-text">A payment collect request will be sent to your UPI App</span>
                </div>

                <div className="quick-upi-chips">
                  <button type="button" onClick={() => setUpiId(`${passengerName.toLowerCase().replace(/\s+/g, '')}@okaxis`)}>
                    @okaxis
                  </button>
                  <button type="button" onClick={() => setUpiId(`${passengerName.toLowerCase().replace(/\s+/g, '')}@okhdfcbank`)}>
                    @okhdfcbank
                  </button>
                  <button type="button" onClick={() => setUpiId(`${passengerName.toLowerCase().replace(/\s+/g, '')}@ybl`)}>
                    @ybl
                  </button>
                </div>

                <button
                  type="button"
                  className="btn-pay-now"
                  onClick={() => handleStartPayment(`UPI ID (${upiId || 'user@upi'})`)}
                >
                  <Lock size={15} />
                  <span>Verify & Pay ₹{amount}</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            )}

            {/* TAB 3: DEBIT / CREDIT CARD */}
            {activeTab === 'card' && (
              <div className="tab-pane card-pane">
                <div className="card-input-grid">
                  <div className="form-group full-col">
                    <label className="form-label">Card Number (RuPay / Visa / MasterCard)</label>
                    <input
                      type="text"
                      className="form-input font-mono"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                    />
                  </div>

                  <div className="form-group full-col">
                    <label className="form-label">Name on Card</label>
                    <input
                      type="text"
                      className="form-input"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Expiry (MM/YY)</label>
                    <input
                      type="text"
                      className="form-input font-mono"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">CVV</label>
                    <input
                      type="password"
                      maxLength={4}
                      className="form-input font-mono"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-pay-now"
                  onClick={() => handleStartPayment('RuPay / Debit Card (Verified by Visa/RuPay)')}
                >
                  <Lock size={15} />
                  <span>Pay Securely ₹{amount}</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            )}

            {/* TAB 4: NET BANKING */}
            {activeTab === 'netbanking' && (
              <div className="tab-pane netbanking-pane">
                <div className="form-group">
                  <label className="form-label">Select Your Bank</label>
                  <select
                    className="form-select"
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                  >
                    <option value="State Bank of India (SBI)">State Bank of India (SBI)</option>
                    <option value="HDFC Bank">HDFC Bank</option>
                    <option value="ICICI Bank">ICICI Bank</option>
                    <option value="Bank of Baroda (Gujarat)">Bank of Baroda (Gujarat)</option>
                    <option value="Axis Bank">Axis Bank</option>
                    <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                    <option value="Punjab National Bank">Punjab National Bank</option>
                  </select>
                </div>

                <div className="bank-logos-strip">
                  <span className="bank-badge">SBI</span>
                  <span className="bank-badge">HDFC</span>
                  <span className="bank-badge">ICICI</span>
                  <span className="bank-badge">BOB</span>
                </div>

                <button
                  type="button"
                  className="btn-pay-now"
                  onClick={() => handleStartPayment(`Net Banking (${selectedBank})`)}
                >
                  <Lock size={15} />
                  <span>Proceed to {selectedBank} • Pay ₹{amount}</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            )}

            {/* TAB 5: AMTS JANMITRA SMART CARD */}
            {activeTab === 'smart_card' && (
              <div className="tab-pane smart-card-pane">
                <div className="janmitra-card-visual">
                  <div className="card-visual-top">
                    <span className="card-visual-chip">AMTS RFID</span>
                    <span className="card-visual-brand">Janmitra Card</span>
                  </div>
                  <div className="card-visual-number font-mono">{smartCardId}</div>
                  <div className="card-visual-bottom">
                    <span>Balance: <strong>₹340.00</strong></span>
                    <span>Valid: <strong>2028</strong></span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">AMTS Janmitra Card Number</label>
                  <input
                    type="text"
                    className="form-input font-mono"
                    value={smartCardId}
                    onChange={(e) => setSmartCardId(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  className="btn-pay-now janmitra-btn"
                  onClick={() => handleStartPayment('AMTS Janmitra Smart Card (RFID FastPay)')}
                >
                  <Lock size={15} />
                  <span>Deduct ₹{amount} from Smart Card Balance</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* GATEWAY STATE: PROCESSING */}
        {gatewayState === 'processing' && (
          <div className="payment-processing-box">
            <div className="gateway-spinner-ring"></div>
            <div className="processing-title">Processing Payment</div>
            <div className="processing-sub">{processingStep}</div>
            <div className="processing-amount-tag">₹{amount}</div>
            <div className="security-notice">
              <Lock size={13} className="text-emerald" />
              <span>Please do not refresh or close this window. Transaction is 256-bit encrypted.</span>
            </div>
          </div>
        )}

        {/* GATEWAY STATE: SUCCESS */}
        {gatewayState === 'success' && (
          <div className="payment-success-box">
            <div className="success-icon-ring">
              <CheckCircle2 size={48} className="text-emerald animate-bounce" />
            </div>
            <h3 className="success-title">Payment Received!</h3>
            <p className="success-sub">Transaction Verified & Approved by AMTS Transit Gateway</p>

            <div className="success-receipt-card">
              <div className="receipt-row">
                <span>Transaction ID:</span>
                <strong className="font-mono">{txId}</strong>
              </div>
              <div className="receipt-row">
                <span>Amount Paid:</span>
                <strong className="text-emerald font-bold">₹{amount}.00</strong>
              </div>
              <div className="receipt-row">
                <span>Payment Mode:</span>
                <strong>{methodName}</strong>
              </div>
              <div className="receipt-row">
                <span>Status:</span>
                <span className="badge-paid">COMPLETED</span>
              </div>
            </div>

            <div className="generating-ticket-indicator">
              <Sparkles size={16} className="text-amber animate-spin-slow" />
              <span>Generating Official Verified AMTS E-Ticket...</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="payment-footer">
          <div className="secure-badge">
            <Lock size={12} />
            <span>256-Bit SSL Encrypted • RBI & NPCI Verified</span>
          </div>
          <div className="compliance-tag">AMTS Smart Mobility Ahmedabad</div>
        </div>
      </div>
    </div>
  );
};
