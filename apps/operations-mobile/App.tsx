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
  const [podModalVisible, setPodModalVisible] = useState<boolean>(false);

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
    setLoading(true);
    try {
      await apiRequest<any>(`/driver/trips/${activeTrip.id}/pod`, {
        method: 'POST',
        body: JSON.stringify({
          receiver_name: receiverName,
          file_url: 'https://cargox.internal/pod/' + Date.now() + '.jpg',
          notes: podNotes
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

                  {/* Pay on Delivery Information Block */}
                  {activeTrip.collection_status && activeTrip.collection_status !== 'NOT_REQUIRED' && (
                    <View style={{ backgroundColor: Colors.surface, borderRadius: 8, padding: 12, marginTop: 12, borderWidth: 1, borderColor: Colors.border }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: Colors.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
                          Payment Method: {activeTrip.payment_method || 'Pay on Delivery'}
                        </Text>
                        <View style={{ backgroundColor: activeTrip.collection_status === 'COLLECTED' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ color: activeTrip.collection_status === 'COLLECTED' ? Colors.success : Colors.warning, fontSize: 10, fontWeight: '800' }}>
                            {activeTrip.collection_status}
                          </Text>
                        </View>
                      </View>
                      {activeTrip.amount_due_for_collection && (
                        <Text style={{ color: Colors.textPrimary, fontSize: 16, fontWeight: '800', marginTop: 4 }}>
                          Due for Collection: ₹{parseFloat(activeTrip.amount_due_for_collection).toFixed(2)}
                        </Text>
                      )}
                    </View>
                  )}

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
              <Text style={styles.modalTitle}>Capture Proof of Delivery</Text>
              <Text style={styles.label}>Receiver Contact Name</Text>
              <TextInput style={styles.input} value={receiverName} onChangeText={setReceiverName} />

              <Text style={styles.label}>Delivery Notes / Sign-off</Text>
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
