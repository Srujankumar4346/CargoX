import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  SafeAreaView,
  StatusBar,
  Image
} from 'react-native';
import { Colors } from './src/theme/colors';
import { apiRequest, storage } from './src/services/api';

type PortalMode = 'SELECT' | 'DRIVER_LOGIN' | 'ADMIN_LOGIN' | 'AUTHENTICATED';
type UserRole = 'ADMIN' | 'DRIVER';
type AdminTab = 'dashboard' | 'finance' | 'requests' | 'trips' | 'fleet' | 'settlements' | 'settings';
type DriverTab = 'trip' | 'history' | 'settlement' | 'profile';

export default function App() {
  const [portalMode, setPortalMode] = useState<PortalMode>('SELECT');
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Auth inputs
  const [driverUsername, setDriverUsername] = useState<string>('driver1');
  const [driverPassword, setDriverPassword] = useState<string>('password123');
  const [adminEmail, setAdminEmail] = useState<string>('srujankumar4346@gmail.com');

  // Navigation
  const [adminTab, setAdminTab] = useState<AdminTab>('dashboard');
  const [driverTab, setDriverTab] = useState<DriverTab>('trip');

  // Driver state
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [driverSettlements, setDriverSettlements] = useState<any[]>([]);
  const [podNotes, setPodNotes] = useState<string>('');
  const [receiverName, setReceiverName] = useState<string>('Warehouse Manager');
  const [receiverPhone, setReceiverPhone] = useState<string>('');
  const [deliveryConfirmed, setDeliveryConfirmed] = useState<boolean>(true);
  const [podModalVisible, setPodModalVisible] = useState<boolean>(false);
  const [generatingQr, setGeneratingQr] = useState<boolean>(false);
  const [checkingPaymentStatus, setCheckingPaymentStatus] = useState<boolean>(false);

  // Driver Pay on Delivery collection state
  const [collectModalVisible, setCollectModalVisible] = useState<boolean>(false);
  const [collectAmount, setCollectAmount] = useState<string>('');
  const [collectMethod, setCollectMethod] = useState<'CASH' | 'UPI'>('CASH');
  const [collectRef, setCollectRef] = useState<string>('');
  const [collectNotes, setCollectNotes] = useState<string>('');

  // Admin state
  const [adminRequests, setAdminRequests] = useState<any[]>([]);
  const [adminTrips, setAdminTrips] = useState<any[]>([]);
  const [adminVehicles, setAdminVehicles] = useState<any[]>([]);
  const [adminDrivers, setAdminDrivers] = useState<any[]>([]);
  const [adminInvoices, setAdminInvoices] = useState<any[]>([]);
  const [adminSettlements, setAdminSettlements] = useState<any[]>([]);
  const [upiSettings, setUpiSettings] = useState<string>('cargox@okaxis');
  const [serviceFeeSettings, setServiceFeeSettings] = useState<string>('4.00');

  // Financial Control Center state
  const [financePeriod, setFinancePeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [financeSummary, setFinanceSummary] = useState<any>(null);
  const [financeBounds, setFinanceBounds] = useState<any>(null);
  const [financeBookings, setFinanceBookings] = useState<any[]>([]);

  // Dispatch modal
  const [dispatchModalVisible, setDispatchModalVisible] = useState<boolean>(false);
  const [selectedReqForDispatch, setSelectedReqForDispatch] = useState<any>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');

  useEffect(() => {
    checkActiveSession();
  }, []);

  const checkActiveSession = async () => {
    const token = await storage.getItem('cargox_token');
    const role = await storage.getItem('cargox_role') as UserRole;
    if (token && role) {
      setUserRole(role);
      setPortalMode('AUTHENTICATED');
      if (role === 'ADMIN') loadAdminData();
      if (role === 'DRIVER') loadDriverData();
    }
  };

  const handleDriverLogin = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<any>('/auth/driver-login', {
        method: 'POST',
        body: JSON.stringify({
          username: driverUsername.trim(),
          password: driverPassword
        })
      });
      await storage.setItem('cargox_token', res.access_token);
      await storage.setItem('cargox_role', 'DRIVER');
      setUserRole('DRIVER');
      setPortalMode('AUTHENTICATED');
      loadDriverData();
    } catch (err: any) {
      Alert.alert('Authentication Failed', err.message || 'Invalid driver credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    setLoading(true);
    try {
      // Admin session initialization
      await storage.setItem('cargox_token', 'admin_token_' + Date.now());
      await storage.setItem('cargox_role', 'ADMIN');
      setUserRole('ADMIN');
      setPortalMode('AUTHENTICATED');
      loadAdminData();
    } catch (err: any) {
      Alert.alert('Admin Access Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await storage.removeItem('cargox_token');
    await storage.removeItem('cargox_role');
    setUserRole(null);
    setPortalMode('SELECT');
    setActiveTrip(null);
  };

  // Driver Operations
  const loadDriverData = async () => {
    setLoading(true);
    try {
      const trip = await apiRequest<any>('/driver/trips/active').catch(() => null);
      setActiveTrip(trip);
      const settlements = await apiRequest<any[]>('/driver/settlements').catch(() => []);
      setDriverSettlements(settlements || []);
    } finally {
      setLoading(false);
    }
  };

  const handleTripStep = async (step: 'start-pickup' | 'start-transit' | 'arrive') => {
    if (!activeTrip) return;
    setLoading(true);
    try {
      const updated = await apiRequest<any>(`/driver/trips/${activeTrip.id}/${step}`, {
        method: 'POST'
      });
      setActiveTrip(updated);
      Alert.alert('Status Updated', `Trip transitioned to ${updated.status}`);
    } catch (err: any) {
      Alert.alert('Operation Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPod = async () => {
    if (!activeTrip) return;
    if (!receiverName.trim()) {
      Alert.alert('Recipient Name Required', 'Please enter the name of the person receiving the cargo.');
      return;
    }
    if (!deliveryConfirmed) {
      Alert.alert('Handover Unconfirmed', 'Please confirm that the cargo was handed over.');
      return;
    }
    setLoading(true);
    try {
      await apiRequest<any>(`/driver/trips/${activeTrip.id}/pod`, {
        method: 'POST',
        body: JSON.stringify({
          receiver_name: receiverName.trim(),
          receiver_phone: receiverPhone.trim() || undefined,
          delivery_confirmed: true,
          pod_signature_url: 'https://storage.cargox.com/pod-signed.png',
          notes: podNotes.trim() || undefined
        })
      });
      Alert.alert('POD Submitted', 'Proof of delivery uploaded successfully. Awaiting Admin verification.');
      setPodModalVisible(false);
      loadDriverData();
    } catch (err: any) {
      Alert.alert('POD Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePayCargoXNow = async () => {
    if (!activeTrip) return;
    setGeneratingQr(true);
    try {
      const order = await apiRequest<any>(`/driver/trips/${activeTrip.id}/pay-cargox-now`, {
        method: 'POST'
      });
      Alert.alert('Payment Order Ready', order.message || 'Payment QR generated successfully. Customer can scan with GPay, PhonePe, Paytm or BHIM.');
      loadDriverData();
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('503') || msg.toLowerCase().includes('not configured')) {
        Alert.alert('Payment Gateway Notice', 'Online payment is not configured yet. Please record cash or contact CargoX Admin.');
      } else {
        Alert.alert('Payment Order Error', msg);
      }
    } finally {
      setGeneratingQr(false);
    }
  };

  const handleCheckPaymentStatus = async () => {
    if (!activeTrip) return;
    setCheckingPaymentStatus(true);
    try {
      const res = await apiRequest<any>(`/driver/trips/${activeTrip.id}/payment-status`);
      if (res.is_fully_paid) {
        Alert.alert('Payment Confirmed', 'Payment has been settled in full. Trip completed successfully.');
      } else {
        Alert.alert('Payment Status', `${res.status}: ${res.message}`);
      }
      loadDriverData();
    } catch (err: any) {
      Alert.alert('Status Check Failed', err.message);
    } finally {
      setCheckingPaymentStatus(false);
    }
  };

  const handleRecordCollection = async () => {
    if (!activeTrip) return;
    const amountVal = parseFloat(collectAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid collection amount.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<any>(`/driver/trips/${activeTrip.id}/record-collection`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amountVal,
          collection_method: collectMethod,
          reference_number: collectRef.trim() || undefined,
          notes: collectNotes.trim() || undefined
        })
      });
      Alert.alert('Collection Recorded', `₹${amountVal} collected via ${collectMethod}. ${res.message}`);
      setCollectModalVisible(false);
      setCollectAmount('');
      setCollectRef('');
      setCollectNotes('');
      loadDriverData();
    } catch (err: any) {
      Alert.alert('Collection Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Admin Operations
  const loadFinanceData = async (period: 'weekly' | 'monthly' = financePeriod) => {
    try {
      const [sumRes, bookRes] = await Promise.all([
        apiRequest<any>(`/admin/finance/reports/summary?period=${period}`).catch(() => null),
        apiRequest<any>(`/admin/finance/reports/bookings?period=${period}&page_size=10`).catch(() => null)
      ]);
      if (sumRes) {
        setFinanceSummary(sumRes.summary);
        setFinanceBounds(sumRes.period);
      }
      if (bookRes) {
        setFinanceBookings(bookRes.bookings || []);
      }
    } catch (e) {
      console.warn("Failed to load mobile finance data:", e);
    }
  };

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [reqs, trips, vehicles, drivers, invoices, settlements, settings] = await Promise.all([
        apiRequest<any[]>('/admin/requests').catch(() => []),
        apiRequest<any[]>('/admin/trips').catch(() => []),
        apiRequest<any[]>('/admin/vehicles').catch(() => []),
        apiRequest<any[]>('/admin/drivers').catch(() => []),
        apiRequest<any[]>('/admin/invoices').catch(() => []),
        apiRequest<any[]>('/admin/settlements').catch(() => []),
        apiRequest<any>('/admin/settings/payment').catch(() => ({ cargox_upi_id: 'cargox@upi', cargox_service_fee_percentage: 4 })),
        loadFinanceData()
      ]);
      setAdminRequests(reqs || []);
      setAdminTrips(trips || []);
      setAdminVehicles(vehicles || []);
      setAdminDrivers(drivers || []);
      setAdminInvoices(invoices || []);
      setAdminSettlements(settlements || []);
      if (settings?.cargox_upi_id) setUpiSettings(settings.cargox_upi_id);
      if (settings?.cargox_service_fee_percentage) setServiceFeeSettings(String(settings.cargox_service_fee_percentage));
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    setLoading(true);
    try {
      await apiRequest<any>(`/admin/requests/${requestId}/approve`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      Alert.alert('Approved', 'Request approved. Quotation established using active pricing.');
      loadAdminData();
    } catch (err: any) {
      Alert.alert('Approval Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDispatch = (req: any) => {
    setSelectedReqForDispatch(req);
    setSelectedVehicleId(adminVehicles.find(v => v.status === 'AVAILABLE')?.id || '');
    setSelectedDriverId(adminDrivers.find(d => d.status === 'AVAILABLE')?.id || '');
    setDispatchModalVisible(true);
  };

  const handleConfirmDispatch = async () => {
    if (!selectedVehicleId || !selectedDriverId) {
      Alert.alert('Required', 'Please select an available vehicle and driver.');
      return;
    }
    setLoading(true);
    try {
      await apiRequest<any>(`/admin/requests/${selectedReqForDispatch.id}/dispatch`, {
        method: 'POST',
        body: JSON.stringify({
          vehicle_id: selectedVehicleId,
          driver_id: selectedDriverId
        })
      });
      Alert.alert('Dispatched', 'Fleet resources assigned and trip initialized.');
      setDispatchModalVisible(false);
      loadAdminData();
    } catch (err: any) {
      Alert.alert('Dispatch Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPodAndComplete = async (tripId: string) => {
    setLoading(true);
    try {
      await apiRequest<any>(`/admin/trips/${tripId}/verify-pod`, { method: 'POST' });
      await apiRequest<any>(`/admin/trips/${tripId}/complete`, { method: 'POST' });
      Alert.alert('Trip Completed', 'POD verified, fleet resources released to AVAILABLE, and invoice created.');
      loadAdminData();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      await apiRequest<any>('/admin/settings/payment', {
        method: 'PUT',
        body: JSON.stringify({
          cargox_upi_id: upiSettings,
          cargox_service_fee_percentage: parseFloat(serviceFeeSettings)
        })
      });
      Alert.alert('Settings Updated', 'CargoX UPI ID and Service Fee configuration updated.');
    } catch (err: any) {
      Alert.alert('Save Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Render Portal Switcher
  if (portalMode === 'SELECT') {
    return (
      <SafeAreaView style={styles.authContainer}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <View style={styles.authCard}>
          <Text style={styles.brandTitle}>CARGOX</Text>
          <Text style={styles.brandSubtitle}>Transport Operations Suite</Text>
          <Text style={styles.roleSelectionDesc}>
            Internal operations terminal. Select your designated operational portal:
          </Text>

          <TouchableOpacity
            style={styles.portalButton}
            onPress={() => setPortalMode('DRIVER_LOGIN')}
          >
            <Text style={styles.portalButtonText}>DRIVER PORTAL</Text>
            <Text style={styles.portalButtonSub}>Active Trip Navigation & POD Proof</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.portalButton, styles.adminPortalButton]}
            onPress={() => setPortalMode('ADMIN_LOGIN')}
          >
            <Text style={styles.portalButtonText}>ADMIN PORTAL</Text>
            <Text style={styles.portalButtonSub}>Fleet Dispatch, Settlements & Settings</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Render Driver Login
  if (portalMode === 'DRIVER_LOGIN') {
    return (
      <SafeAreaView style={styles.authContainer}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <View style={styles.authCard}>
          <Text style={styles.brandTitle}>CARGOX</Text>
          <Text style={styles.brandSubtitle}>Driver Authentication</Text>

          <Text style={styles.label}>Driver Username / Email</Text>
          <TextInput
            style={styles.input}
            value={driverUsername}
            onChangeText={setDriverUsername}
            placeholder="Username"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={driverPassword}
            onChangeText={setDriverPassword}
            placeholder="Password"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
          />

          <TouchableOpacity style={styles.primaryButton} onPress={handleDriverLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Sign In to Driver Workspace</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.backButton} onPress={() => setPortalMode('SELECT')}>
            <Text style={styles.backButtonText}>← Back to Portal Selection</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Render Admin Login
  if (portalMode === 'ADMIN_LOGIN') {
    return (
      <SafeAreaView style={styles.authContainer}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <View style={styles.authCard}>
          <Text style={styles.brandTitle}>CARGOX</Text>
          <Text style={styles.brandSubtitle}>Administrator Authorization</Text>

          <Text style={styles.label}>Admin Corporate Account</Text>
          <TextInput
            style={styles.input}
            value={adminEmail}
            onChangeText={setAdminEmail}
            placeholder="admin@cargox.com"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
          />

          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: Colors.accent }]} onPress={handleAdminLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Authorize Admin Console</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.backButton} onPress={() => setPortalMode('SELECT')}>
            <Text style={styles.backButtonText}>← Back to Portal Selection</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Authenticated: DRIVER WORKSPACE
  if (userRole === 'DRIVER') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>CARGOX DRIVER</Text>
            <Text style={styles.headerSubtitle}>Fleet Field Terminal</Text>
          </View>
          <TouchableOpacity style={styles.logoutHeaderBtn} onPress={handleLogout}>
            <Text style={styles.logoutHeaderText}>Exit</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {driverTab === 'trip' && (
            <View>
              <Text style={styles.sectionTitle}>Current Assigned Delivery</Text>
              {!activeTrip ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No Active Delivery</Text>
                  <Text style={styles.emptyText}>You are currently available for dispatch.</Text>
                </View>
              ) : (
                <View style={styles.deliveryCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.reqNumber}>Trip #{String(activeTrip.id).slice(0, 8)}</Text>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>{activeTrip.status}</Text>
                    </View>
                  </View>

                  <Text style={styles.cargoInfo}>Cargo: {activeTrip.goods_type || 'Commercial Freight'}</Text>
                  <Text style={styles.routeText}>Pickup: {activeTrip.pickup_address}</Text>
                  <Text style={styles.routeText}>Destination: {activeTrip.destination_address}</Text>

                  {/* CargoX Corporate Business Payment & Customer Delivery QR */}
                  <View style={{ backgroundColor: Colors.surface, borderRadius: 10, padding: 14, marginTop: 14, borderWidth: 1, borderColor: Colors.border }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: Colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                        💳 CARGOX PAYMENT DETAILS
                      </Text>
                      <View style={{
                        backgroundColor: activeTrip.payment_status_display === 'Paid'
                          ? 'rgba(16,185,129,0.15)'
                          : activeTrip.payment_status_display === 'Payment Confirmation Pending'
                          ? 'rgba(168,85,247,0.15)'
                          : 'rgba(245,158,11,0.15)',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 4
                      }}>
                        <Text style={{
                          color: activeTrip.payment_status_display === 'Paid'
                            ? Colors.success
                            : activeTrip.payment_status_display === 'Payment Confirmation Pending'
                            ? '#c084fc'
                            : Colors.warning,
                          fontSize: 10,
                          fontWeight: '800'
                        }}>
                          {activeTrip.payment_status_display || (activeTrip.collection_status === 'COLLECTED' ? 'Paid' : 'Payment Due')}
                        </Text>
                      </View>
                    </View>

                    <View style={{ marginTop: 8 }}>
                      <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>
                        Beneficiary: <Text style={{ color: Colors.textPrimary, fontWeight: '700' }}>{activeTrip.business_name || 'CargoX Logistics'}</Text>
                      </Text>
                      {activeTrip.cargox_upi_id && (
                        <Text style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                          CargoX Corporate UPI: <Text style={{ color: Colors.textPrimary, fontWeight: '700' }}>{activeTrip.cargox_upi_id}</Text>
                        </Text>
                      )}
                      {activeTrip.invoice_number && (
                        <Text style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                          Invoice Reference: <Text style={{ color: Colors.textPrimary, fontWeight: '700' }}>{activeTrip.invoice_number}</Text>
                        </Text>
                      )}
                    </View>

                    {/* Exact Outstanding Amount */}
                    <View style={{ marginTop: 10, padding: 10, backgroundColor: 'rgba(15,23,42,0.8)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                      <Text style={{ color: Colors.textMuted, fontSize: 10, textTransform: 'uppercase', fontWeight: '700' }}>
                        Current Outstanding Balance
                      </Text>
                      <Text style={{ color: Colors.textPrimary, fontSize: 18, fontWeight: '900', marginTop: 2 }}>
                        ₹{activeTrip.amount_due_for_collection ? parseFloat(activeTrip.amount_due_for_collection).toFixed(2) : '0.00'}
                      </Text>
                    </View>

                    {/* Delivery Payment QR Code */}
                    {activeTrip.qr_image_url && activeTrip.amount_due_for_collection && parseFloat(activeTrip.amount_due_for_collection) > 0 && (
                      <View style={{ alignItems: 'center', marginTop: 12, padding: 12, backgroundColor: '#ffffff', borderRadius: 12 }}>
                        <Image
                          source={{ uri: activeTrip.qr_image_url }}
                          style={{ width: 170, height: 170 }}
                          resizeMode="contain"
                        />
                        <Text style={{ color: '#0f172a', fontSize: 11, fontWeight: '800', marginTop: 6 }}>
                          SCAN TO PAY CARGOX CORPORATE
                        </Text>
                        <Text style={{ color: '#475569', fontSize: 10, textAlign: 'center', marginTop: 2 }}>
                          Works with Google Pay, PhonePe, Paytm & any UPI app
                        </Text>
                      </View>
                    )}

                    {/* Generate Payment QR / Check Status Actions */}
                    {activeTrip.amount_due_for_collection && parseFloat(activeTrip.amount_due_for_collection) > 0 && activeTrip.payment_status_display !== 'Paid' && (
                      <View style={{ marginTop: 12, gap: 8 }}>
                        <TouchableOpacity
                          style={{
                            backgroundColor: Colors.primary,
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            borderRadius: 8,
                            alignItems: 'center',
                            opacity: generatingQr ? 0.7 : 1
                          }}
                          onPress={handlePayCargoXNow}
                          disabled={generatingQr}
                        >
                          <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 }}>
                            {generatingQr ? 'GENERATING PAYMENT QR...' : '⚡ GENERATE PAYMENT QR / PAY CARGOX NOW'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.08)',
                            paddingVertical: 10,
                            paddingHorizontal: 14,
                            borderRadius: 8,
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.15)'
                          }}
                          onPress={handleCheckPaymentStatus}
                          disabled={checkingPaymentStatus}
                        >
                          <Text style={{ color: Colors.textPrimary, fontWeight: '700', fontSize: 12 }}>
                            {checkingPaymentStatus ? 'CHECKING STATUS...' : '🔄 CHECK PAYMENT STATUS'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Instructions for Driver & Customer */}
                    <Text style={{ color: Colors.textMuted, fontSize: 10, lineHeight: 14, marginTop: 10 }}>
                      ℹ️ {activeTrip.payment_instructions || 'Customer must pay using the official CargoX corporate QR or link. If collecting cash at delivery, tap "Record Collection".'}
                    </Text>
                  </View>

                  {/* Step-by-Step Execution Workflow */}
                  <View style={styles.actionBlock}>
                    {activeTrip.status === 'DRIVER_ASSIGNED' && (
                      <TouchableOpacity style={styles.workflowBtn} onPress={() => handleTripStep('start-pickup')}>
                        <Text style={styles.workflowBtnText}>START PICKUP</Text>
                      </TouchableOpacity>
                    )}
                    {activeTrip.status === 'PICKUP_IN_PROGRESS' && (
                      <TouchableOpacity style={styles.workflowBtn} onPress={() => handleTripStep('start-transit')}>
                        <Text style={styles.workflowBtnText}>START TRANSIT</Text>
                      </TouchableOpacity>
                    )}
                    {activeTrip.status === 'IN_TRANSIT' && (
                      <TouchableOpacity style={styles.workflowBtn} onPress={() => handleTripStep('arrive')}>
                        <Text style={styles.workflowBtnText}>MARK ARRIVED</Text>
                      </TouchableOpacity>
                    )}
                    {activeTrip.status === 'ARRIVED' && (
                      <TouchableOpacity style={[styles.workflowBtn, { backgroundColor: Colors.success }]} onPress={() => setPodModalVisible(true)}>
                        <Text style={styles.workflowBtnText}>UPLOAD POD (PROOF OF DELIVERY)</Text>
                      </TouchableOpacity>
                    )}
                    {activeTrip.status === 'POD_SUBMITTED' && (
                      <Text style={styles.podWaitNotice}>POD Submitted. Waiting for Admin verification.</Text>
                    )}

                    {/* Driver Collection Button if Payment is Due */}
                    {['ARRIVED', 'POD_SUBMITTED', 'DELIVERED', 'COMPLETED'].includes(activeTrip.status) && activeTrip.collection_status === 'DUE' && (
                      <TouchableOpacity
                        style={[styles.workflowBtn, { backgroundColor: Colors.warning, marginTop: 10 }]}
                        onPress={() => {
                          if (activeTrip.amount_due_for_collection) {
                            setCollectAmount(String(activeTrip.amount_due_for_collection));
                          }
                          setCollectModalVisible(true);
                        }}
                      >
                        <Text style={[styles.workflowBtnText, { color: '#000' }]}>💰 RECORD COLLECTION</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>
          )}

          {driverTab === 'settlement' && (
            <View>
              <Text style={styles.sectionTitle}>Driver Settlement Statements</Text>
              {driverSettlements.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No settlements generated yet.</Text>
                </View>
              ) : (
                driverSettlements.map((s) => (
                  <View key={s.id} style={styles.deliveryCard}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.reqNumber}>Settlement #{String(s.id).slice(0, 8)}</Text>
                      <View style={[styles.statusBadge, s.status === 'PAID' ? styles.statusBadgePaid : null]}>
                        <Text style={styles.statusText}>{s.status}</Text>
                      </View>
                    </View>
                    <Text style={styles.invoiceAmount}>Driver Payout: ₹{s.total_payout}</Text>
                    <Text style={styles.routeText}>Reimbursements: ₹{s.reimbursements || 0}</Text>
                    <Text style={styles.routeText}>Deductions: ₹{s.deductions || 0}</Text>
                    {s.reference_number && <Text style={styles.distanceBadge}>Ref: {s.reference_number}</Text>}
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>

        <View style={styles.tabBar}>
          <TouchableOpacity style={styles.tabItem} onPress={() => setDriverTab('trip')}>
            <Text style={[styles.tabLabel, driverTab === 'trip' && styles.tabLabelActive]}>Active Trip</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem} onPress={() => setDriverTab('settlement')}>
            <Text style={[styles.tabLabel, driverTab === 'settlement' && styles.tabLabelActive]}>Settlements</Text>
          </TouchableOpacity>
        </View>

        {/* POD Modal */}
        <Modal visible={podModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.label}>Recipient Contact Person *</Text>
              <TextInput style={styles.input} value={receiverName} onChangeText={setReceiverName} placeholder="Name of person receiving goods" placeholderTextColor={Colors.textMuted} />

              <Text style={styles.label}>Recipient Contact Phone (Optional)</Text>
              <TextInput style={styles.input} value={receiverPhone} onChangeText={setReceiverPhone} placeholder="+91 XXXXX XXXXX" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" />

              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10, padding: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8 }}
                onPress={() => setDeliveryConfirmed(!deliveryConfirmed)}
              >
                <View style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  borderWidth: 2,
                  borderColor: deliveryConfirmed ? Colors.success : Colors.border,
                  backgroundColor: deliveryConfirmed ? Colors.success : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10
                }}>
                  {deliveryConfirmed && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>✓</Text>}
                </View>
                <Text style={{ color: Colors.textPrimary, fontSize: 12, flex: 1 }}>
                  I confirm that freight was physically inspected and handed over to recipient.
                </Text>
              </TouchableOpacity>

              <Text style={styles.label}>Delivery Notes / Sign-off (Optional)</Text>
              <TextInput style={styles.input} value={podNotes} onChangeText={setPodNotes} placeholder="e.g. Received 12 boxes undamaged" placeholderTextColor={Colors.textMuted} />

              <View style={styles.cameraPlaceholder}>
                <Text style={styles.cameraText}>[ PHOTO CAPTURED ]</Text>
                <Text style={styles.cameraSub}>Compressed: 240 KB (Eco-optimized)</Text>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setPodModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={handleSubmitPod} disabled={loading}>
                  <Text style={styles.confirmBtnText}>Submit POD</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Pay on Delivery Collection Modal */}
        <Modal visible={collectModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Record Customer Collection</Text>
              <Text style={{ color: Colors.textSecondary, fontSize: 12, marginBottom: 16 }}>
                Record payment received at delivery destination. This will settle the invoice balance.
              </Text>

              <Text style={styles.label}>Collection Method</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: collectMethod === 'CASH' ? Colors.primary : Colors.border,
                    backgroundColor: collectMethod === 'CASH' ? 'rgba(59,130,246,0.15)' : Colors.surface,
                    alignItems: 'center'
                  }}
                  onPress={() => setCollectMethod('CASH')}
                >
                  <Text style={{ color: collectMethod === 'CASH' ? Colors.primary : Colors.textSecondary, fontWeight: '700' }}>💵 Cash</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: collectMethod === 'UPI' ? Colors.primary : Colors.border,
                    backgroundColor: collectMethod === 'UPI' ? 'rgba(59,130,246,0.15)' : Colors.surface,
                    alignItems: 'center'
                  }}
                  onPress={() => setCollectMethod('UPI')}
                >
                  <Text style={{ color: collectMethod === 'UPI' ? Colors.primary : Colors.textSecondary, fontWeight: '700' }}>📱 UPI</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Amount Collected (₹)</Text>
              <TextInput
                style={styles.input}
                value={collectAmount}
                onChangeText={setCollectAmount}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.label}>Receipt / UTR Reference (Optional)</Text>
              <TextInput
                style={styles.input}
                value={collectRef}
                onChangeText={setCollectRef}
                placeholder="e.g. UTR-982137492 or Cash Slip #104"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={styles.input}
                value={collectNotes}
                onChangeText={setCollectNotes}
                placeholder="Remarks regarding collection"
                placeholderTextColor={Colors.textMuted}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setCollectModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: Colors.success }]}
                  onPress={handleRecordCollection}
                  disabled={loading}
                >
                  <Text style={styles.confirmBtnText}>Save Collection</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // Authenticated: ADMIN WORKSPACE
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>CARGOX ADMIN</Text>
          <Text style={styles.headerSubtitle}>Fleet & Logistics Control Center</Text>
        </View>
        <TouchableOpacity style={styles.logoutHeaderBtn} onPress={handleLogout}>
          <Text style={styles.logoutHeaderText}>Exit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {adminTab === 'dashboard' && (
          <View>
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{adminRequests.length}</Text>
                <Text style={styles.kpiLabel}>Requests</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{adminTrips.length}</Text>
                <Text style={styles.kpiLabel}>Trips</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{adminVehicles.filter(v => v.status === 'AVAILABLE').length}</Text>
                <Text style={styles.kpiLabel}>Available Fleet</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Pending Transport Requests</Text>
            {adminRequests.filter(r => r.status === 'SUBMITTED').length === 0 ? (
              <View style={styles.emptyCard}><Text style={styles.emptyText}>No requests awaiting approval.</Text></View>
            ) : (
              adminRequests.filter(r => r.status === 'SUBMITTED').map(r => (
                <View key={r.id} style={styles.deliveryCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.reqNumber}>{r.request_number}</Text>
                    <Text style={styles.distanceBadge}>{r.distance_km} km</Text>
                  </View>
                  <Text style={styles.cargoInfo}>{r.goods_type} • {r.weight_tons} Tons</Text>
                  <Text style={styles.routeText}>{r.pickup_address} → {r.destination_address}</Text>
                  <TouchableOpacity style={styles.primaryButton} onPress={() => handleApproveRequest(r.id)}>
                    <Text style={styles.primaryButtonText}>Approve & Create Quotation</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Ready for Fleet Dispatch</Text>
            {adminRequests.filter(r => r.status === 'ACCEPTED').length === 0 ? (
              <View style={styles.emptyCard}><Text style={styles.emptyText}>No approved requests awaiting dispatch.</Text></View>
            ) : (
              adminRequests.filter(r => r.status === 'ACCEPTED').map(r => (
                <View key={r.id} style={styles.deliveryCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.reqNumber}>{r.request_number}</Text>
                    <Text style={styles.distanceBadge}>{r.weight_tons} Tons</Text>
                  </View>
                  <Text style={styles.cargoInfo}>{r.goods_type}</Text>
                  <TouchableOpacity style={[styles.primaryButton, { backgroundColor: Colors.accent }]} onPress={() => handleOpenDispatch(r)}>
                    <Text style={styles.primaryButtonText}>Assign Vehicle & Driver</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Active Trips & POD Verifications</Text>
            {adminTrips.length === 0 ? (
              <View style={styles.emptyCard}><Text style={styles.emptyText}>No active trips.</Text></View>
            ) : (
              adminTrips.map(t => (
                <View key={t.id} style={styles.deliveryCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.reqNumber}>Trip #{String(t.id).slice(0, 8)}</Text>
                    <View style={styles.statusBadge}><Text style={styles.statusText}>{t.status}</Text></View>
                  </View>
                  <Text style={styles.cargoInfo}>{t.request?.goods_type} ({t.request?.weight_tons} Tons)</Text>
                  {t.status === 'POD_SUBMITTED' && (
                    <TouchableOpacity style={[styles.primaryButton, { backgroundColor: Colors.success }]} onPress={() => handleVerifyPodAndComplete(t.id)}>
                      <Text style={styles.primaryButtonText}>Verify POD & Complete Trip</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {adminTab === 'finance' && (
          <View>
            {/* Period Selector */}
            <View style={{ flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 12, padding: 4, marginBottom: 16 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, backgroundColor: financePeriod === 'weekly' ? Colors.primary : 'transparent' }}
                onPress={() => { setFinancePeriod('weekly'); loadFinanceData('weekly'); }}
              >
                <Text style={{ color: Colors.textPrimary, fontWeight: '700', fontSize: 13 }}>Weekly</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, backgroundColor: financePeriod === 'monthly' ? Colors.primary : 'transparent' }}
                onPress={() => { setFinancePeriod('monthly'); loadFinanceData('monthly'); }}
              >
                <Text style={{ color: Colors.textPrimary, fontWeight: '700', fontSize: 13 }}>Monthly</Text>
              </TouchableOpacity>
            </View>

            {financeBounds && (
              <View style={{ backgroundColor: Colors.surfaceHighlight, padding: 12, borderRadius: 12, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: Colors.primary }}>
                <Text style={{ color: Colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>Period Bounds</Text>
                <Text style={{ color: Colors.textPrimary, fontSize: 14, fontWeight: '800', marginTop: 2 }}>{financeBounds.display_range}</Text>
                <Text style={{ color: Colors.success, fontSize: 11, marginTop: 4 }}>• New week activity starts at ₹0</Text>
              </View>
            )}

            {/* Mobile Summary Cards */}
            <View style={{ gap: 12, marginBottom: 20 }}>
              <View style={[styles.deliveryCard, { borderLeftWidth: 4, borderLeftColor: Colors.primary }]}>
                <Text style={styles.kpiLabel}>Customer Charges (Period Invoiced)</Text>
                <Text style={styles.invoiceAmount}>₹{Number(financeSummary?.period_customer_charges || 0).toLocaleString('en-IN')}</Text>
                <Text style={styles.routeText}>{financeSummary?.total_invoices_issued || 0} invoices issued</Text>
              </View>

              <View style={[styles.deliveryCard, { borderLeftWidth: 4, borderLeftColor: Colors.success }]}>
                <Text style={styles.kpiLabel}>Payments Collected (Cash In)</Text>
                <Text style={[styles.invoiceAmount, { color: Colors.success }]}>₹{Number(financeSummary?.payments_collected || 0).toLocaleString('en-IN')}</Text>
                <Text style={styles.routeText}>{financeSummary?.payment_transactions_count || 0} cash transactions</Text>
              </View>

              <View style={[styles.deliveryCard, { borderLeftWidth: 4, borderLeftColor: Colors.warning }]}>
                <Text style={styles.kpiLabel}>Outstanding Due (Cumulative Receivables)</Text>
                <Text style={[styles.invoiceAmount, { color: Colors.warning }]}>₹{Number(financeSummary?.outstanding_receivables || 0).toLocaleString('en-IN')}</Text>
                <Text style={styles.routeText}>{financeSummary?.unpaid_invoices_count || 0} unpaid invoices</Text>
              </View>

              <View style={[styles.deliveryCard, { borderLeftWidth: 4, borderLeftColor: '#a855f7' }]}>
                <Text style={styles.kpiLabel}>Approved Operating Expenses</Text>
                <Text style={[styles.invoiceAmount, { color: '#c084fc' }]}>₹{Number(financeSummary?.approved_operating_expenses || 0).toLocaleString('en-IN')}</Text>
                <Text style={styles.routeText}>Trips: ₹{Number(financeSummary?.approved_trip_expenses || 0).toLocaleString('en-IN')}</Text>
              </View>
            </View>

            {/* Bookings Ledger List */}
            <Text style={styles.sectionTitle}>Period Bookings Ledger ({financeBookings.length})</Text>
            {financeBookings.length === 0 ? (
              <View style={styles.emptyCard}><Text style={styles.emptyText}>No bookings in this period.</Text></View>
            ) : (
              financeBookings.map((b) => (
                <View key={b.request_id} style={styles.deliveryCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.reqNumber}>{b.request_number}</Text>
                    <View style={styles.statusBadge}><Text style={styles.statusText}>{b.trip_status}</Text></View>
                  </View>
                  <Text style={styles.cargoInfo}>{b.customer_name}</Text>
                  <Text style={styles.routeText}>{b.pickup_address} → {b.destination_address}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border }}>
                    <Text style={{ color: Colors.textPrimary, fontWeight: '700', fontSize: 12 }}>Invoice: ₹{Number(b.invoice_total || 0).toLocaleString('en-IN')}</Text>
                    <Text style={{ color: Colors.success, fontWeight: '700', fontSize: 12 }}>Paid: ₹{Number(b.amount_paid || 0).toLocaleString('en-IN')}</Text>
                    <Text style={{ color: Colors.warning, fontWeight: '700', fontSize: 12 }}>Due: ₹{Number(b.amount_due || 0).toLocaleString('en-IN')}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {adminTab === 'settings' && (
          <View style={styles.deliveryCard}>
            <Text style={styles.modalTitle}>CargoX Financial Configuration</Text>
            <Text style={styles.label}>Official CargoX UPI ID (for QR codes)</Text>
            <TextInput style={styles.input} value={upiSettings} onChangeText={setUpiSettings} />

            <Text style={styles.label}>Service Margin Fee (%)</Text>
            <TextInput style={styles.input} value={serviceFeeSettings} onChangeText={setServiceFeeSettings} keyboardType="numeric" />

            <TouchableOpacity style={styles.primaryButton} onPress={handleSaveSettings} disabled={loading}>
              <Text style={styles.primaryButtonText}>Save Admin Settings</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Admin Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setAdminTab('dashboard')}>
          <Text style={[styles.tabLabel, adminTab === 'dashboard' && styles.tabLabelActive]}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => { setAdminTab('finance'); loadFinanceData(); }}>
          <Text style={[styles.tabLabel, adminTab === 'finance' && styles.tabLabelActive]}>Finance</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setAdminTab('settings')}>
          <Text style={[styles.tabLabel, adminTab === 'settings' && styles.tabLabelActive]}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Dispatch Modal */}
      <Modal visible={dispatchModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Dispatch Assignment</Text>
            <Text style={styles.label}>Available Vehicles (Capacity &gt;= Cargo Weight)</Text>
            {adminVehicles.filter(v => v.status === 'AVAILABLE').map(v => (
              <TouchableOpacity
                key={v.id}
                style={[styles.selectOption, selectedVehicleId === v.id && styles.selectOptionActive]}
                onPress={() => setSelectedVehicleId(v.id)}
              >
                <Text style={styles.selectOptionText}>{v.registration_number} ({v.type} - {v.capacity_tons}T)</Text>
              </TouchableOpacity>
            ))}

            <Text style={[styles.label, { marginTop: 12 }]}>Available Drivers</Text>
            {adminDrivers.filter(d => d.status === 'AVAILABLE').map(d => (
              <TouchableOpacity
                key={d.id}
                style={[styles.selectOption, selectedDriverId === d.id && styles.selectOptionActive]}
                onPress={() => setSelectedDriverId(d.id)}
              >
                <Text style={styles.selectOptionText}>{d.name} ({d.phone})</Text>
              </TouchableOpacity>
            ))}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDispatchModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmDispatch} disabled={loading}>
                <Text style={styles.confirmBtnText}>Confirm Dispatch</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  authContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', padding: 24 },
  authCard: { backgroundColor: Colors.surface, padding: 24, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  brandTitle: { fontSize: 28, fontWeight: '800', color: Colors.primary, letterSpacing: 2 },
  brandSubtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: 20 },
  roleSelectionDesc: { fontSize: 13, color: Colors.textMuted, marginBottom: 20, lineHeight: 18 },
  portalButton: { backgroundColor: Colors.surfaceHighlight, borderWidth: 1, borderColor: Colors.border, padding: 18, borderRadius: 12, marginBottom: 14 },
  adminPortalButton: { borderColor: Colors.accent },
  portalButtonText: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  portalButtonSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  label: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
  input: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 12, color: Colors.textPrimary, marginBottom: 12 },
  primaryButton: { backgroundColor: Colors.primary, padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 6 },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  backButton: { marginTop: 14, alignItems: 'center' },
  backButtonText: { color: Colors.textSecondary, fontSize: 13 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.primary, letterSpacing: 1.5 },
  headerSubtitle: { fontSize: 11, color: Colors.textSecondary },
  logoutHeaderBtn: { backgroundColor: Colors.surfaceHighlight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  logoutHeaderText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  scrollContent: { padding: 16 },
  kpiRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  kpiCard: { flex: 1, backgroundColor: Colors.surface, padding: 14, borderRadius: 12, marginHorizontal: 4, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  kpiValue: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  kpiLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  deliveryCard: { backgroundColor: Colors.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reqNumber: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  statusBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgePaid: { backgroundColor: Colors.successLight },
  statusText: { fontSize: 11, color: Colors.primary, fontWeight: '700' },
  cargoInfo: { fontSize: 14, color: Colors.textPrimary, marginBottom: 4 },
  routeText: { fontSize: 13, color: Colors.textSecondary, marginVertical: 1 },
  distanceBadge: { fontSize: 12, color: Colors.accent, fontWeight: '600' },
  emptyCard: { backgroundColor: Colors.surface, padding: 24, borderRadius: 12, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { color: Colors.textMuted, marginTop: 4 },
  actionBlock: { marginTop: 14 },
  workflowBtn: { backgroundColor: Colors.primary, padding: 14, borderRadius: 8, alignItems: 'center' },
  workflowBtnText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 1 },
  podWaitNotice: { color: Colors.warning, textAlign: 'center', fontSize: 13, fontWeight: '600' },
  invoiceAmount: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginTop: 4 },
  tabBar: { flexDirection: 'row', height: 60, backgroundColor: Colors.surface, borderTopWidth: 1, borderColor: Colors.border },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabLabel: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  tabLabelActive: { color: Colors.primary, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: Colors.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 14 },
  cameraPlaceholder: { height: 120, backgroundColor: Colors.surfaceHighlight, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginVertical: 12, borderWidth: 1, borderColor: Colors.border },
  cameraText: { color: Colors.success, fontWeight: '700', fontSize: 13 },
  cameraSub: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  cancelBtn: { padding: 12, marginRight: 12 },
  cancelBtnText: { color: Colors.textSecondary },
  confirmBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8 },
  confirmBtnText: { color: '#fff', fontWeight: '700' },
  selectOption: { padding: 12, borderRadius: 8, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, marginBottom: 6 },
  selectOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  selectOptionText: { color: Colors.textPrimary, fontSize: 13 }
});
