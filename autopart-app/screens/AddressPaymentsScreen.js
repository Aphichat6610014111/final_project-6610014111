import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Modal, FlatList, TouchableWithoutFeedback, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Assets from '../assets/assetsIndex';

export default function AddressPaymentsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [renderError, setRenderError] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [editing, setEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [street, setStreet] = useState('');
  const [apt, setApt] = useState('');
  const [district, setDistrict] = useState('');
  const [province, setProvince] = useState('');
  const [zip, setZip] = useState('');

  // payment method state
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [payment, setPayment] = useState(null); // saved payment info from backend
  const [editingPayment, setEditingPayment] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState(null);

  // payment form fields
  const [cardNumber, setCardNumber] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [cvv, setCvv] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  // UI state for selected payment method (card / paypal)
  const [method, setMethod] = useState('card');
  // Expiration pickers
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [yearPickerVisible, setYearPickerVisible] = useState(false);
  // delete confirmation modal state
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const months = Array.from({ length: 12 }, (_, i) => ({ key: String(i + 1).padStart(2, '0'), label: String(i + 1).padStart(2, '0') }));
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 25 }, (_, i) => ({ key: String(currentYear + i), label: String(currentYear + i) }));

  const loadAddresses = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setAddresses([]); return;
      }
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const res = await fetch('http://localhost:5000/api/users/shipping', { headers });
      if (res.ok) {
        const j = await res.json();
        setAddresses(j.data?.addresses || []);
      } else {
        setAddresses([]);
      }
    } catch (err) {
      console.warn('Load addresses failed', err); setAddresses([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadAddresses(); loadPayment(); }, []);

  const loadPayment = async () => {
    // backend uses /api/users/payment-methods to list payment methods metadata
    setPaymentLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) { setPayment(null); return; }
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const res = await fetch('http://localhost:5000/api/users/payment-methods', { headers });
      if (res.ok) {
        const j = await res.json();
        // backend returns { data: { paymentMethods: [...] } }
        const pms = j.data?.paymentMethods || [];
        // pick default or first
        const pm = pms.find(x => x.isDefault) || pms[0] || null;
        if (pm) {
          setPayment({ cardBrand: pm.brand || pm.provider || null, cardNumberMasked: pm.last4 || null, expMonth: pm.expMonth || null, expYear: pm.expYear || null, _id: pm._id || null });
        } else {
          setPayment(null);
        }
      } else {
        if (res.status === 404) {
          console.warn('Payment-methods endpoint not found (404). Check backend routes or server status.');
        } else {
          console.warn('Failed to load payment methods:', res.status);
        }
        setPayment(null);
      }
    } catch (err) {
      console.warn('Load payment failed', err); setPayment(null);
    } finally { setPaymentLoading(false); }
  };

  const startEdit = (a) => {
    if (!a) {
      setEditing(true); setEditingId(null);
      setFirstName(''); setLastName(''); setStreet(''); setApt(''); setDistrict(''); setProvince(''); setZip('');
      return;
    }
    setEditing(true); setEditingId(a._id || null);
    setFirstName(a.firstName || ''); setLastName(a.lastName || ''); setStreet(a.street || ''); setApt(a.apt || ''); setDistrict(a.district || ''); setProvince(a.province || ''); setZip(a.zip || '');
  };

  const startEditPayment = (p) => {
    if (!p) {
      setEditingPayment(true); setEditingPaymentId(null);
      setCardNumber(''); setExpMonth(''); setExpYear(''); setCvv('');
      return;
    }
    setEditingPayment(true); setEditingPaymentId(p._id || null);
    setCardNumber(p.cardNumberMasked || ''); setExpMonth(p.expMonth || ''); setExpYear(p.expYear || ''); setCvv('');
  };

  const detectCardBrand = (num) => {
    if (!num) return '';
    const n = num.replace(/\s+/g, '');
    if (/^4/.test(n)) return 'Visa';
    if (/^5[1-5]/.test(n)) return 'MasterCard';
    if (/^3[47]/.test(n)) return 'American Express';
    if (/^6/.test(n)) return 'Discover';
    return '';
  };

  // update selected brand when card number input changes
  useEffect(() => {
    const b = detectCardBrand(cardNumber);
    if (b) setSelectedBrand(b);
  }, [cardNumber]);

  // handle card number input: allow only digits, max 16 digits, format with spaces every 4
  const handleCardNumberChange = (txt) => {
    const digits = (txt || '').replace(/\D+/g, '').slice(0, 16); // max 16 digits
    const parts = digits.match(/.{1,4}/g) || [];
    setCardNumber(parts.join(' '));
  };

  const cancelPaymentEdit = () => { setEditingPayment(false); setEditingPaymentId(null); };

  const savePayment = async () => {
  const digitsOnly = (cardNumber || '').replace(/\s+/g, '');
  if (!digitsOnly || !expMonth || !expYear || !cvv) return Alert.alert('กรุณากรอกข้อมูลบัตร', 'กรุณากรอกหมายเลขบัตร วันหมดอายุ และ CVV');
  if (digitsOnly.length !== 16) return Alert.alert('Invalid card number', 'Card number must be exactly 16 digits');
  if (!/^[0-9]{3}$/.test(cvv)) return Alert.alert('Invalid CVV', 'CVV must be exactly 3 digits');
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return Alert.alert('Not authenticated', 'Please login first');
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const body = { cardNumber, expMonth, expYear, cvv };
      let res;
      // Backend expects tokenized provider data at /api/users/payment-methods
      if (editingPaymentId) {
        // update metadata-only fields
        const allowed = { brand: detectCardBrand(cardNumber), last4: cardNumber.replace(/\s+/g, '').slice(-4), expMonth, expYear };
        res = await fetch(`http://localhost:5000/api/users/payment-methods/${editingPaymentId}`, { method: 'PUT', headers, body: JSON.stringify(allowed) });
      } else {
        // For local/testing purposes we send a fake token and provider; in production integrate with a payment provider
  const brandToSend = selectedBrand || detectCardBrand(cardNumber) || 'card';
  const payload = { provider: 'local', token: 'tok_local_123', brand: brandToSend, last4: cardNumber.replace(/\s+/g, '').slice(-4), expMonth, expYear };
        res = await fetch('http://localhost:5000/api/users/payment-methods', { method: 'POST', headers, body: JSON.stringify(payload) });
      }
      if (!res.ok) {
        const e = await res.json().catch(()=>({ message: 'Unknown' }));
        return Alert.alert('Failed', e.message || 'Save failed');
      }
      // Update local payment state immediately so inputs hide and summary shows like Billing info
      const last4 = cardNumber.replace(/\s+/g, '').slice(-4);
      const brand = detectCardBrand(cardNumber);
      const localPayment = { cardBrand: brand, cardNumberMasked: last4, expMonth, expYear };
      setPayment(localPayment);
      setEditingPayment(false);
      setEditingPaymentId(null);
      // clear sensitive fields
      setCardNumber(''); setCvv('');
      // try to refresh from backend but don't rely on it for UI
      loadPayment().catch(()=>{});
      Alert.alert('Saved', 'Payment saved');
    } catch (err) { console.error('Save payment failed', err); Alert.alert('Error', 'Save failed'); }
  };

  // show confirmation modal for deletion
  const handleDeletePayment = (pmId) => {
    if (!pmId) return Alert.alert('ไม่พบข้อมูล', 'ไม่พบรหัสช่องทางการชำระเงิน');
    setConfirmDeleteId(pmId);
    setConfirmDeleteVisible(true);
  };

  const performDeletePayment = async () => {
    const pmId = confirmDeleteId;
    setConfirmDeleteVisible(false);
    if (!pmId) return Alert.alert('ไม่พบข้อมูล', 'ไม่พบรหัสช่องทางการชำระเงิน');
    setPaymentLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) { setPaymentLoading(false); return Alert.alert('Not authenticated', 'Please login first'); }
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const res = await fetch(`http://localhost:5000/api/users/payment-methods/${pmId}`, { method: 'DELETE', headers });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ message: 'Unknown' }));
        setPaymentLoading(false);
        return Alert.alert('Failed', e.message || 'Delete failed');
      }
      setPayment(null);
      await loadPayment();
      Alert.alert('Deleted', 'Payment method removed');
    } catch (err) {
      console.error('Delete payment failed', err);
      Alert.alert('Error', 'Delete failed');
    } finally {
      setPaymentLoading(false);
      setConfirmDeleteId(null);
    }
  };

  const cancelEdit = () => { setEditing(false); setEditingId(null); };

  const saveAddress = async () => {
    if (!firstName || !street || !district) return Alert.alert('กรุณากรอกข้อมูลที่จำเป็น', 'กรุณากรอกชื่อ ที่อยู่ และอำเภอ/เขต');
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return Alert.alert('Not authenticated', 'Please login first');
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const body = { firstName, lastName, street, apt, district, province, zip };
      let res;
      if (editingId) {
        res = await fetch(`http://localhost:5000/api/users/shipping/${editingId}`, { method: 'PUT', headers, body: JSON.stringify(body) });
      } else {
        res = await fetch('http://localhost:5000/api/users/shipping', { method: 'POST', headers, body: JSON.stringify(body) });
      }
      if (!res.ok) {
        const e = await res.json().catch(()=>({ message: 'Unknown' }));
        return Alert.alert('Failed', e.message || 'Save failed');
      }
      await loadAddresses(); setEditing(false); setEditingId(null); Alert.alert('Saved', 'Address saved');
    } catch (err) { console.error('Save failed', err); Alert.alert('Error', 'Save failed'); }
  };

  // Wrap render in try/catch so we can capture runtime render errors and show a helpful fallback
  try {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 18 }}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation && navigation.goBack && navigation.goBack()}>
            <Text style={styles.backText}>←  ย้อนกลับ</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} />
        </View>
        <Text style={styles.pageTitle}>Payment information</Text>

        {/* Billing information */}
        {loading ? (
          <View style={[styles.panel, styles.panelBlack, { alignItems: 'center' }]}><ActivityIndicator color="#fff" /></View>
        ) : (
          editing || addresses.length === 0 ? (
            <View style={[styles.panel, styles.panelBlack]}>
              <View style={styles.panelHeader}><Text style={styles.panelTitle}>Billing information</Text></View>
              <View style={styles.panelBody}>
                <TextInput value={firstName} onChangeText={setFirstName} placeholder="First name *" placeholderTextColor="rgba(255,255,255,0.4)" style={styles.input} />
                <TextInput value={lastName} onChangeText={setLastName} placeholder="Last name" placeholderTextColor="rgba(255,255,255,0.4)" style={[styles.input, { marginTop: 8 }]} />
                <TextInput value={street} onChangeText={setStreet} placeholder="Address (Street, P.O. box) *" placeholderTextColor="rgba(255,255,255,0.4)" style={[styles.inputFull, { marginTop: 8 }]} />
                <TextInput value={apt} onChangeText={setApt} placeholder="Address 2 (Apartment, suite, unit)" placeholderTextColor="rgba(255,255,255,0.4)" style={styles.inputFull} />
                <TextInput value={district} onChangeText={setDistrict} placeholder="City / District *" placeholderTextColor="rgba(255,255,255,0.4)" style={styles.inputFull} />
                <View style={{ flexDirection: 'row', marginTop: 6 }}>
                  <TextInput value={province} onChangeText={setProvince} placeholder="State/Province" placeholderTextColor="rgba(255,255,255,0.4)" style={[styles.input, { marginRight: 8 }]} />
                  <TextInput value={zip} onChangeText={setZip} placeholder="Postal/Zip code" placeholderTextColor="rgba(255,255,255,0.4)" style={[styles.input, { flex: 0.6 }]} keyboardType="numeric" />
                </View>

                <View style={{ flexDirection: 'row', marginTop: 12 }}>
                  <TouchableOpacity style={styles.saveBtn} onPress={saveAddress}><Text style={styles.saveText}>Save billing information</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.cancelBtn, { marginLeft: 8 }]} onPress={cancelEdit}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            <View style={[styles.panel, styles.panelBlack]}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>Billing information</Text>
                <TouchableOpacity style={styles.smallAction} onPress={() => startEdit(addresses[0])}><Text style={styles.smallActionText}>Edit</Text></TouchableOpacity>
              </View>
              <View style={styles.panelBody}>
                <Text style={styles.bold}>{addresses[0]?.firstName || ''} {addresses[0]?.lastName || ''}</Text>
                <Text style={styles.muted}>{addresses[0]?.street || ''} {addresses[0]?.apt ? `, ${addresses[0].apt}` : ''}</Text>
                <Text style={styles.muted}>{addresses[0]?.district || ''}, {addresses[0]?.province || ''} {addresses[0]?.zip || ''}</Text>
                <Text style={styles.muted}>Thailand</Text>
              </View>
            </View>
          )
        )}

        {/* Payment method (inline editable like Billing) */}
        <View style={[styles.panel, styles.panelBlack]}>
          <View style={styles.panelHeader}>
            <View style={styles.headerLeft}>
              <Text style={styles.panelTitle}>Payment method</Text>
              {/* payment summary shown under title when a saved payment exists (matches provided HTML) */}
              {payment && !editingPayment ? (
                <View style={styles.paymentSummary}>
                  <Text style={styles.paymentSummaryText}>
                    {payment.cardBrand ? `${payment.cardBrand}: ` : 'Credit Card: '}
                    <Text style={{ color: '#fff', fontWeight: '700' }}>{payment.cardNumberMasked ? `ending ${payment.cardNumberMasked}` : ''}</Text>
                  </Text>
                  {payment.expMonth && payment.expYear ? (
                    <Text style={styles.paymentSummaryText}>expiring {payment.expMonth}/{payment.expYear}</Text>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={styles.headerRight}>
              {/* only show header Edit/Delete buttons when a saved payment exists and we're not editing */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {/* Add */}
                <TouchableOpacity style={styles.editBtn} onPress={() => startEditPayment(null)}>
                  <Text style={styles.editBtnText}>Add</Text>
                </TouchableOpacity>

                {/* Edit (enabled when payment exists) */}
                <TouchableOpacity
                  style={[styles.editBtn, { marginLeft: 8 }, (!payment || paymentLoading || editingPayment) ? { opacity: 0.55 } : null]}
                  disabled={!payment || paymentLoading || editingPayment}
                  onPress={() => startEditPayment(payment)}
                >
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>

                {/* Delete (enabled when payment exists) */}
                <TouchableOpacity
                  style={[styles.smallAction, { marginLeft: 8 }, (!payment || paymentLoading || editingPayment) ? { opacity: 0.55 } : null]}
                  disabled={!payment || paymentLoading || editingPayment}
                  onPress={() => handleDeletePayment(payment?._id)}
                >
                  <Text style={[styles.smallActionText, { color: '#ff6b6b' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {paymentLoading ? (
            <View style={[styles.panelBody, { alignItems: 'center' }]}><ActivityIndicator color="#fff" /></View>
          ) : (
            editingPayment || !payment ? (
              <View style={[styles.panel, styles.panelBlack]}>
                <Text style={styles.sectionLabel}>Pay with</Text>
                <View style={styles.segmentRow}>
                  <TouchableOpacity style={[styles.segmentBtn, method === 'card' ? styles.segmentBtnActive : null]} onPress={() => setMethod('card')}>
                    <Text style={[styles.segmentText, method === 'card' ? styles.segmentTextActive : null]}>Credit or debit card</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.segmentBtn, method === 'paypal' ? styles.segmentBtnActive : null]} onPress={() => setMethod('paypal')}>
                    <Text style={[styles.segmentText, method === 'paypal' ? styles.segmentTextActive : null]}>PayPal account</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.divider} />

                {method === 'paypal' ? (
                  <View style={styles.paypalBlock}>
                    <TouchableOpacity style={styles.paypalBtn} onPress={() => { /* TODO: trigger PayPal flow */ }}>
                      <Text style={styles.paypalBtnText}>PayPal</Text>
                    </TouchableOpacity>
                    <Text style={styles.muted}>You are currently paying with a credit card, but you can switch to using PayPal at any time.</Text>
                    <View style={styles.infoBox}>
                      <Text style={styles.infoText}> We may place a temporary hold on your payment method to verify its validity. This is not a charge, and it will be released automatically after verification.</Text>
                    </View>
                    <View style={{ marginTop: 12 }}>
                      <TouchableOpacity style={styles.cancelBtn} onPress={cancelPaymentEdit}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View>
                    <Text style={styles.fieldLabel}>Card Number *</Text>
                    {/* Card brand selector */}
                    <View style={styles.brandRow}>
                      {/* Brand icons from assetsIndex (compact aliases: mastercard, visa, amex, discover, diners, unionpay) */}
                      {[
                        { label: 'MasterCard', key: 'mastercard' },
                        { label: 'China Union Pay', key: 'unionpay' },
                        { label: 'Diners', key: 'diners' },
                        { label: 'American Express', key: 'amex' },
                        { label: 'Discover', key: 'discover' },
                        { label: 'Visa', key: 'visa' },
                      ].map((b) => {
                        const isActive = selectedBrand && (selectedBrand.toLowerCase().includes(b.label.split(' ')[0].toLowerCase()) || (b.label === 'China Union Pay' && selectedBrand.toLowerCase().includes('union')));
                        const img = Assets.map[b.key];
                        return (
                          <TouchableOpacity key={b.key} style={[styles.brandItem, isActive ? styles.brandItemActive : null]} onPress={() => setSelectedBrand(b.label)}>
                            {img ? <Image source={img} style={styles.brandImage} resizeMode="contain" /> : <Text style={styles.brandText}>{b.label}</Text>}
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <TextInput value={cardNumber} onChangeText={handleCardNumberChange} placeholder="" placeholderTextColor="rgba(255,255,255,0.4)" style={styles.input} keyboardType="numeric" maxLength={19} />

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Expiration Date (YYYY) *</Text>
                        <View style={{ flexDirection: 'row', marginTop: 8 }}>
                          <TouchableOpacity style={styles.select} onPress={() => setMonthPickerVisible(true)}>
                            <Text style={styles.selectText}>{expMonth || '- Select One -'}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.select, { marginLeft: 8 }]} onPress={() => setYearPickerVisible(true)}>
                            <Text style={styles.selectText}>{expYear || '- Select One -'}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={{ flex: 1, marginLeft: 12, flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldLabel}>CVV *</Text>
                          <TextInput
                            value={cvv}
                            onChangeText={(txt) => {
                              const cleaned = (txt || '').replace(/\D+/g, '').slice(0, 3);
                              setCvv(cleaned);
                            }}
                            placeholder=""
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            style={[styles.input, { height: 40, borderColor: '#fff' }]}
                            keyboardType="numeric"
                            maxLength={3}
                          />
                        </View>
                        <View style={{ marginLeft: 8, width: 36, alignItems: 'center' }}>
                          <View style={styles.cvvImgPlaceholder}><Text style={{ fontSize: 10 }}>CVV</Text></View>
                        </View>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', marginTop: 12 }}>
                      <TouchableOpacity style={[styles.saveBtn, { alignSelf: 'flex-start' }]} onPress={savePayment}><Text style={styles.saveText}>Save payment information</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.cancelBtn, { marginLeft: 8 }]} onPress={cancelPaymentEdit}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                    </View>

                    <View style={styles.iframePlaceholder} />

                    <View style={styles.infoBox}>
                      <Text style={styles.infoText}> We may place a temporary hold on your payment method to verify its validity. This is not a charge, and it will be released automatically after verification.</Text>
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.panelBody}>
                {/* Summary already shown in header; keep panel body minimal to avoid duplicate lines */}
              </View>
            )
          )}
        </View>

        <Modal visible={monthPickerVisible} transparent animationType="fade" onRequestClose={() => setMonthPickerVisible(false)}>
          <TouchableWithoutFeedback onPress={() => setMonthPickerVisible(false)}>
            <View style={styles.modalOverlay} />
          </TouchableWithoutFeedback>
          <View style={styles.modalContainer}>
            <FlatList
              data={months}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalItem} onPress={() => { setExpMonth(item.label); setMonthPickerVisible(false); }}>
                  <Text style={styles.modalItemText}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </Modal>

        {/* Year Picker Modal */}
        <Modal visible={yearPickerVisible} transparent animationType="fade" onRequestClose={() => setYearPickerVisible(false)}>
          <TouchableWithoutFeedback onPress={() => setYearPickerVisible(false)}>
            <View style={styles.modalOverlay} />
          </TouchableWithoutFeedback>
          <View style={styles.modalContainer}>
            <FlatList
              data={years}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalItem} onPress={() => { setExpYear(item.label); setYearPickerVisible(false); }}>
                  <Text style={styles.modalItemText}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </Modal>

        {/* Delete confirmation modal */}
        <Modal visible={confirmDeleteVisible} transparent animationType="fade" onRequestClose={() => setConfirmDeleteVisible(false)}>
          <TouchableWithoutFeedback onPress={() => setConfirmDeleteVisible(false)}>
            <View style={styles.modalOverlay} />
          </TouchableWithoutFeedback>
          <View style={[styles.modalContainer, { width: '80%' }]}>
            <View style={{ padding: 16 }}>
              <Text style={{ color: '#fff', fontWeight: '700', marginBottom: 12 }}>Delete payment method</Text>
              <Text style={{ color: 'rgba(255,255,255,0.9)', marginBottom: 18 }}>Are you sure you want to remove this payment method? This cannot be undone.</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <TouchableOpacity style={[styles.cancelBtn, { marginRight: 8 }]} onPress={() => setConfirmDeleteVisible(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={performDeletePayment}><Text style={styles.saveText}>Delete</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </ScrollView>
    );
  } catch (err) {
    // Surface render error for debugging and show fallback UI
    console.error('AddressPaymentsScreen render error:', err);
    const msg = (err && err.message) ? err.message : String(err);
    return (
      <View style={styles.container}>
        <Text style={{ color: '#fff', margin: 12 }}>เกิดข้อผิดพลาดในการแสดงผล: {msg}</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={() => navigation && navigation.goBack && navigation.goBack()}>
          <Text style={styles.saveText}>ย้อนกลับ</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

// Note: modal components rendered inside the component return would be better, but
// for simplicity we render them just after the component (React Native allows only within component).

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  pageTitle: { color: '#ffffff', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  backButton: { paddingVertical: 8, paddingHorizontal: 10 },
  backText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerTitle: { flex: 1, textAlign: 'center' },

  panel: { backgroundColor: '#0b1620', borderRadius: 8, borderWidth: 1, borderColor: '#fff', padding: 14, marginBottom: 12 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  panelTitle: { color: '#fff', fontWeight: '700' },
  panelBody: { marginTop: 4 },

  headerLeft: { flex: 1 },
  headerRight: { justifyContent: 'flex-end', alignItems: 'flex-end' },
  paymentSummary: { marginTop: 6 },
  paymentSummaryText: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  editBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  editBtnText: { color: '#fff', fontWeight: '700' },

  bold: { color: '#ffffff', fontWeight: '700', marginBottom: 6 },
  muted: { color: 'rgba(255,255,255,0.75)', marginBottom: 4 },

  smallAction: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  smallActionText: { color: '#fff', fontWeight: '700' },

  ghostAction: { backgroundColor: 'transparent', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  ghostActionText: { color: 'rgba(255,255,255,0.9)', fontWeight: '600' },

  input: {
    backgroundColor: '#0b1620',
    color: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)'
  },
  inputFull: { backgroundColor: '#0b1620', color: '#fff', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', marginTop: 8 },

  sectionLabel: { color: 'rgba(255,255,255,0.95)', marginBottom: 8 },
  fieldLabel: { color: '#ffffff', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  segmentRow: { flexDirection: 'row', backgroundColor: 'transparent' },
  segmentBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.02)', marginRight: 8 },
  segmentBtnActive: { backgroundColor: 'rgba(255,255,255,0.06)' },
  segmentText: { color: 'rgba(255,255,255,0.9)' },
  segmentTextActive: { color: '#fff', fontWeight: '700' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.03)', marginVertical: 12 },
  select: { flex: 1, backgroundColor: '#000', borderRadius: 6, borderWidth: 1, borderColor: '#fff', paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { color: 'rgba(255,255,255,0.95)' },
  cvvImgPlaceholder: { width: 36, height: 24, backgroundColor: '#fff', borderRadius: 2, justifyContent: 'center', alignItems: 'center' },
  iframePlaceholder: { height: 220, backgroundColor: '#020406', marginTop: 12, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.02)' },
  infoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(64,110,156,0.12)', borderRadius: 6, padding: 12, marginTop: 12, borderWidth: 1, borderColor: 'rgba(64,110,156,0.2)' },
  infoText: { color: '#e6f4ff', flex: 1, fontSize: 13 },

  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContainer: { maxHeight: '60%', width: '80%', backgroundColor: '#0b1620', alignSelf: 'center', marginTop: 80, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  modalItem: { paddingVertical: 10, paddingHorizontal: 14, borderBottomColor: 'rgba(255,255,255,0.03)', borderBottomWidth: 1 },
  modalItemText: { color: 'rgba(255,255,255,0.95)' },

  paypalBlock: { paddingVertical: 8 },
  paypalBtn: { backgroundColor: '#0070ba', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 12 },
  paypalBtnText: { color: '#fff', fontWeight: '700' },

  saveBtn: { backgroundColor: '#ff6b6b', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 6 },
  saveText: { color: '#fff', fontWeight: '700' },
  cancelBtn: { backgroundColor: '#1f2937', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 6 },
  cancelText: { color: '#fff', fontWeight: '700' }
  ,
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 8 },
  brandItem: { paddingVertical: 4, paddingHorizontal: 6, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.02)', marginRight: 6 },
  brandItemActive: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)' },
  brandText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' }
  ,
  brandImage: { width: 44, height: 22 }
  ,
  panelBlack: { backgroundColor: '#000', borderColor: '#fff' }
});

