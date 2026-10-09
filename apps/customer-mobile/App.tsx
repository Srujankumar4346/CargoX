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
  StatusBar
} from 'react-native';
import { Colors } from './src/theme/colors';
import { apiRequest, storage } from './src/services/api';

type Tab = 'home' | 'bookings' | 'trips' | 'invoices' | 'profile';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [authEmailInput, setAuthEmailInput] = useState<string>('customer@acmelogistics.com');
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [loading, setLoading] = useState<boolean>(false);

  // Data states
  const [requests, setRequests] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  
  // New Booking Modal
  const [bookingModalVisible, setBookingModalVisible] = useState<boolean>(false);
  const [goodsType, setGoodsType] = useState<string>('Heavy Machinery & Parts');
  const [weightTons, setWeightTons] = useState<string>('12.5');
  const [pickupAddress, setPickupAddress] = useState<string>('Balanagar Industrial Area, Hyderabad');
  const [destAddress, setDestAddress] = useState<string>('Warangal Logistics Park, Telangana');
  const [pickupLat, setPickupLat] = useState<string>('17.4700');
  const [pickupLng, setPickupLng] = useState<string>('78.4400');
  const [destLat, setDestLat] = useState<string>('17.9689');
  const [destLng, setDestLng] = useState<string>('79.5941');
  const [estimatedDistance, setEstimatedDistance] = useState<string>('');
  const [estimatedCost, setEstimatedCost] = useState<string>('');
  const [calculatingRoute, setCalculatingRoute] = useState<boolean>(false);

  // UPI Payment Modal
  const [upiModalVisible, setUpiModalVisible] = useState<boolean>(false);
  const [currentUpiData, setCurrentUpiData] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = await storage.getItem('cargox_token');
    const email = await storage.getItem('cargox_user_email');
    if (token) {
      setIsAuthenticated(true);
      setUserEmail(email || 'customer@cargox.com');
      loadCustomerData();
    }
  };

  const handleLogin = async () => {
    if (!authEmailInput.trim()) {
      Alert.alert('Required', 'Please enter your customer company email.');
      return;
    }
    setLoading(true);
    try {
      // In production, Clerk or direct JWT is exchanged. We simulate saving authoritative session
      await storage.setItem('cargox_token', 'cust_token_' + Date.now());
      await storage.setItem('cargox_user_email', authEmailInput.trim().toLowerCase());
      setIsAuthenticated(true);
      setUserEmail(authEmailInput.trim().toLowerCase());
      loadCustomerData();
    } catch (err: any) {
      Alert.alert('Login Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await storage.removeItem('cargox_token');
    await storage.removeItem('cargox_user_email');
    setIsAuthenticated(false);
    setRequests([]);
    setInvoices([]);
  };

  const loadCustomerData = async () => {
    setLoading(true);
    try {
      const reqList = await apiRequest<any[]>('/customer/requests').catch(() => []);
      const invList = await apiRequest<any[]>('/customer/invoices').catch(() => []);
      setRequests(reqList || []);
      setInvoices(invList || []);
    } catch {
      // Silent catch or handled by fallback state
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateRoute = async () => {
    setCalculatingRoute(true);
    try {
      const routeRes = await apiRequest<any>('/customer/requests/calculate-route', {
        method: 'POST',
        body: JSON.stringify({
          pickup_lat: parseFloat(pickupLat),
          pickup_lng: parseFloat(pickupLng),
          destination_lat: parseFloat(destLat),
          destination_lng: parseFloat(destLng)
        })
      });
      setEstimatedDistance(String(routeRes.distance_km));

      // Get official estimate from backend pricing
      const estimateRes = await apiRequest<any>(`/customer/quotations/pricing/estimate?distance_km=${routeRes.distance_km}`);
      setEstimatedCost(String(estimateRes.estimated_total));
    } catch (err: any) {
      Alert.alert('Route Error', err.message || 'Could not compute road distance.');
    } finally {
      setCalculatingRoute(false);
    }
  };

  const handleSubmitBooking = async () => {
    if (!estimatedDistance) {
      Alert.alert('Validate Distance', 'Please calculate route distance before submitting.');
      return;
    }
    setLoading(true);
    try {
      await apiRequest<any>('/customer/requests', {
        method: 'POST',
        body: JSON.stringify({
          goods_type: goodsType,
          weight_tons: parseFloat(weightTons),
          distance_km: parseFloat(estimatedDistance),
          pickup_company_name: 'Origin Facility',
          pickup_address: pickupAddress,
          pickup_lat: parseFloat(pickupLat),
          pickup_lng: parseFloat(pickupLng),
          destination_company_name: 'Receiver Facility',
          destination_address: destAddress,
          destination_lat: parseFloat(destLat),
          destination_lng: parseFloat(destLng)
        })
      });
      Alert.alert('Request Submitted', 'CargoX transport coordinators will analyze cargo and dispatch optimal fleet.');
      setBookingModalVisible(false);
      loadCustomerData();
    } catch (err: any) {
      Alert.alert('Booking Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenUpiModal = async (invoiceId: string) => {
    setLoading(true);
    try {
      const upiData = await apiRequest<any>(`/customer/invoices/${invoiceId}/payment-qr`);
      setCurrentUpiData(upiData);
      setUpiModalVisible(true);
    } catch (err: any) {
      Alert.alert('Payment QR Unavailable', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.authContainer}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <View style={styles.authCard}>
          <Text style={styles.brandTitle}>CARGOX</Text>
          <Text style={styles.brandSubtitle}>Customer Transport Portal</Text>
          
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Corporate Email</Text>
            <TextInput
              style={styles.input}
              value={authEmailInput}
              onChangeText={setAuthEmailInput}
              placeholder="e.g. logistics@company.com"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Access Customer Portal</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.authNote}>
            CargoX provides dedicated fleet goods transport. Billing and invoicing are issued directly by CargoX.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>CARGOX</Text>
          <Text style={styles.headerSubtitle}>{userEmail}</Text>
        </View>
        <TouchableOpacity style={styles.newBookingHeaderBtn} onPress={() => setBookingModalVisible(true)}>
          <Text style={styles.newBookingHeaderText}>+ New Booking</Text>
        </TouchableOpacity>
      </View>

      {/* Screen Body */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeTab === 'home' && (
          <View>
            {/* KPI Cards */}
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{requests.filter(r => r.status === 'IN_TRANSIT').length}</Text>
                <Text style={styles.kpiLabel}>In Transit</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{requests.filter(r => r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW').length}</Text>
                <Text style={styles.kpiLabel}>Pending</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{invoices.filter(i => i.status === 'UNPAID').length}</Text>
                <Text style={styles.kpiLabel}>Unpaid Invoices</Text>
              </View>
            </View>

            {/* Quick Action Banner */}
            <TouchableOpacity style={styles.actionBanner} onPress={() => setBookingModalVisible(true)}>
              <Text style={styles.actionBannerTitle}>Book Goods Transport</Text>
              <Text style={styles.actionBannerDesc}>Instant real-distance route quotation & fleet allocation</Text>
            </TouchableOpacity>

            {/* Active Deliveries */}
            <Text style={styles.sectionTitle}>Active Transport Operations</Text>
            {requests.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No transport requests yet.</Text>
              </View>
            ) : (
              requests.map((req) => (
                <View key={req.id} style={styles.deliveryCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.reqNumber}>{req.request_number}</Text>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>{req.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.cargoInfo}>{req.goods_type} • {req.weight_tons} Tons</Text>
                  <Text style={styles.routeText}>From: {req.pickup_address}</Text>
                  <Text style={styles.routeText}>To: {req.destination_address}</Text>
                  <Text style={styles.distanceBadge}>{req.distance_km || 0} km confirmed route</Text>
                  
                  {req.assigned_driver_name && (
                    <View style={styles.driverInfoBox}>
                      <Text style={styles.driverTitle}>Assigned Fleet:</Text>
                      <Text style={styles.driverDetail}>Driver: {req.assigned_driver_name} ({req.assigned_driver_phone})</Text>
                      <Text style={styles.driverDetail}>Vehicle: {req.assigned_vehicle_registration} ({req.assigned_vehicle_type})</Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'invoices' && (
          <View>
            <Text style={styles.sectionTitle}>Invoices & Payments</Text>
            {invoices.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No invoices issued yet.</Text>
              </View>
            ) : (
              invoices.map((inv) => (
                <View key={inv.id} style={styles.deliveryCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.reqNumber}>{inv.invoice_number}</Text>
                    <View style={[styles.statusBadge, inv.status === 'PAID' ? styles.statusBadgePaid : null]}>
                      <Text style={styles.statusText}>{inv.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.invoiceAmount}>Total: ₹{inv.total_amount}</Text>
                  <Text style={styles.invoiceDue}>Amount Due: ₹{inv.amount_due}</Text>
                  
                  {inv.status !== 'PAID' && (
                    <TouchableOpacity
                      style={styles.payNowBtn}
                      onPress={() => handleOpenUpiModal(inv.id)}
                    >
                      <Text style={styles.payNowBtnText}>Pay Now via UPI QR</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'profile' && (
          <View style={styles.profileCard}>
            <Text style={styles.profileEmail}>{userEmail}</Text>
            <Text style={styles.profileRole}>Role: Verified Customer</Text>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutBtnText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Bottom Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('home')}>
          <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('invoices')}>
          <Text style={[styles.tabLabel, activeTab === 'invoices' && styles.tabLabelActive]}>Invoices</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('profile')}>
          <Text style={[styles.tabLabel, activeTab === 'profile' && styles.tabLabelActive]}>Profile</Text>
        </TouchableOpacity>
      </View>

      {/* New Booking Modal */}
      <Modal visible={bookingModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Transport Booking</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.label}>Cargo Type</Text>
              <TextInput style={styles.input} value={goodsType} onChangeText={setGoodsType} />

              <Text style={styles.label}>Weight (Tons)</Text>
              <TextInput style={styles.input} value={weightTons} onChangeText={setWeightTons} keyboardType="numeric" />

              <Text style={styles.label}>Pickup Address</Text>
              <TextInput style={styles.input} value={pickupAddress} onChangeText={setPickupAddress} />

              <Text style={styles.label}>Destination Address</Text>
              <TextInput style={styles.input} value={destAddress} onChangeText={setDestAddress} />

              <TouchableOpacity style={styles.routeBtn} onPress={handleCalculateRoute} disabled={calculatingRoute}>
                {calculatingRoute ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.routeBtnText}>Calculate Official Distance & Rate</Text>
                )}
              </TouchableOpacity>

              {estimatedDistance ? (
                <View style={styles.estimateBox}>
                  <Text style={styles.estimateTitle}>Route Distance: {estimatedDistance} km</Text>
                  <Text style={styles.estimatePrice}>Estimated Charge: ₹{estimatedCost}</Text>
                  <Text style={styles.estimateDisclaimer}>*Estimated until quotation confirmation by CargoX Operations.</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setBookingModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleSubmitBooking} disabled={loading}>
                <Text style={styles.confirmBtnText}>Submit Booking</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* UPI QR Payment Modal */}
      <Modal visible={upiModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>CargoX Instant UPI Payment</Text>
            {currentUpiData && (
              <View style={{ alignItems: 'center', marginVertical: 16 }}>
                <Text style={styles.upiAmount}>₹{currentUpiData.amount_due}</Text>
                <Text style={styles.upiSub}>Invoice: {currentUpiData.invoice_number}</Text>
                <View style={styles.qrPlaceholder}>
                  <Text style={styles.qrCodeText}>[ SCAN WITH ANY UPI APP ]</Text>
                  <Text style={styles.qrId}>{currentUpiData.upi_id}</Text>
                </View>
                <Text style={styles.upiNote}>
                  CargoX verifies and records incoming payments. Never fake or bypass verification.
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.primaryButton} onPress={() => setUpiModalVisible(false)}>
              <Text style={styles.primaryButtonText}>Close Payment Screen</Text>
            </TouchableOpacity>
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
  brandSubtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: 24 },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
  input: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 12, color: Colors.textPrimary, marginBottom: 12 },
  primaryButton: { backgroundColor: Colors.primary, padding: 14, borderRadius: 8, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  authNote: { fontSize: 12, color: Colors.textMuted, marginTop: 16, textAlign: 'center', lineHeight: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.primary, letterSpacing: 1.5 },
  headerSubtitle: { fontSize: 12, color: Colors.textSecondary },
  newBookingHeaderBtn: { backgroundColor: Colors.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  newBookingHeaderText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  scrollContent: { padding: 16 },
  kpiRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  kpiCard: { flex: 1, backgroundColor: Colors.surface, padding: 14, borderRadius: 12, marginHorizontal: 4, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  kpiValue: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  kpiLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 4 },
  actionBanner: { backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primary, padding: 16, borderRadius: 12, marginBottom: 20 },
  actionBannerTitle: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  actionBannerDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  deliveryCard: { backgroundColor: Colors.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reqNumber: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  statusBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgePaid: { backgroundColor: Colors.successLight },
  statusText: { fontSize: 11, color: Colors.primary, fontWeight: '700' },
  cargoInfo: { fontSize: 14, color: Colors.textPrimary, marginBottom: 4 },
  routeText: { fontSize: 13, color: Colors.textSecondary, marginVertical: 1 },
  distanceBadge: { fontSize: 12, color: Colors.accent, marginTop: 6, fontWeight: '600' },
  driverInfoBox: { marginTop: 10, padding: 10, backgroundColor: Colors.surfaceHighlight, borderRadius: 8 },
  driverTitle: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  driverDetail: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  emptyCard: { backgroundColor: Colors.surface, padding: 24, borderRadius: 12, alignItems: 'center' },
  emptyText: { color: Colors.textMuted },
  invoiceAmount: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginTop: 4 },
  invoiceDue: { fontSize: 14, color: Colors.warning, marginTop: 2 },
  payNowBtn: { backgroundColor: Colors.success, padding: 10, borderRadius: 8, marginTop: 12, alignItems: 'center' },
  payNowBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  profileCard: { backgroundColor: Colors.surface, padding: 20, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  profileEmail: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  profileRole: { fontSize: 14, color: Colors.textSecondary, marginTop: 4, marginBottom: 16 },
  logoutBtn: { backgroundColor: Colors.dangerLight, padding: 12, borderRadius: 8, alignItems: 'center' },
  logoutBtnText: { color: Colors.danger, fontWeight: '700' },
  tabBar: { flexDirection: 'row', height: 60, backgroundColor: Colors.surface, borderTopWidth: 1, borderColor: Colors.border },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabLabel: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  tabLabelActive: { color: Colors.primary, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: Colors.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 14 },
  routeBtn: { backgroundColor: Colors.surfaceHighlight, padding: 12, borderRadius: 8, alignItems: 'center', marginVertical: 8 },
  routeBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 13 },
  estimateBox: { backgroundColor: Colors.primaryLight, padding: 12, borderRadius: 8, marginVertical: 8 },
  estimateTitle: { color: Colors.textPrimary, fontWeight: '700' },
  estimatePrice: { color: Colors.primary, fontSize: 18, fontWeight: '800', marginTop: 4 },
  estimateDisclaimer: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  cancelBtn: { padding: 12, marginRight: 12 },
  cancelBtnText: { color: Colors.textSecondary },
  confirmBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8 },
  confirmBtnText: { color: '#fff', fontWeight: '700' },
  upiAmount: { fontSize: 32, fontWeight: '900', color: Colors.success },
  upiSub: { color: Colors.textSecondary, marginTop: 4 },
  qrPlaceholder: { width: 220, height: 220, backgroundColor: '#fff', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginVertical: 16 },
  qrCodeText: { color: '#000', fontWeight: '800', fontSize: 12 },
  qrId: { color: '#333', fontSize: 11, marginTop: 8 },
  upiNote: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 12 }
});
