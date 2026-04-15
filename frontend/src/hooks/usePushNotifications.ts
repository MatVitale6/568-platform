// usePushNotifications.ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
const pushServiceWorkerPath = '/push-sw-v2.js';

function isPlaceholder(value: string | undefined, placeholder: string): boolean {
	return !value || value === placeholder;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = window.atob(base64);
	const outputArray = new Uint8Array(rawData.length);

	for (let index = 0; index < rawData.length; index += 1) {
		outputArray[index] = rawData.charCodeAt(index);
	}

	return outputArray;
}

export const isWebPushConfigured = !isPlaceholder(vapidPublicKey, 'your-vapid-public-key-here');

export function usePushNotifications() {
	const { user } = useAuth();
	const [permission, setPermission] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
	const [enabled, setEnabled] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		if (typeof Notification === 'undefined') {
			setPermission('unsupported');
			return;
		}

		setPermission(Notification.permission);
	}, []);

	useEffect(() => {
		if (!user || !isSupabaseConfigured || !supabase || !isWebPushConfigured) {
			setEnabled(false);
			return;
		}

		const sb = supabase;
		let mounted = true;

		const loadSubscriptionState = async () => {
			const { data, error: loadError } = await sb
				.from('push_subscriptions')
				.select('id')
				.eq('profile_id', user.id)
				.eq('active', true)
				.limit(1);

			if (!mounted) return;
			if (loadError) {
				setError(loadError.message);
				return;
			}

			setEnabled((data ?? []).length > 0);
		};

		loadSubscriptionState();

		return () => {
			mounted = false;
		};
	}, [user]);

	const availability = useMemo(() => {
		if (!user) return 'signed-out';
		if (!isSupabaseConfigured) return 'supabase-missing';
		if (!isWebPushConfigured) return 'vapid-missing';
		if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
		return 'ready';
	}, [user]);

	const enable = useCallback(async () => {
		if (!user || availability !== 'ready' || !supabase) return;

		setLoading(true);
		setError('');

		try {
			const registrations = await navigator.serviceWorker.getRegistrations();
			await Promise.all(
				registrations
					.filter((registration) => !registration.active?.scriptURL.endsWith(pushServiceWorkerPath))
					.map((registration) => registration.unregister()),
			);

			const registration = await navigator.serviceWorker.register(pushServiceWorkerPath, {
				updateViaCache: 'none',
			});
			await registration.update();
			const requestedPermission = await Notification.requestPermission();
			setPermission(requestedPermission);

			if (requestedPermission !== 'granted') {
				throw new Error('Permesso notifiche non concesso');
			}

			let subscription = await registration.pushManager.getSubscription();

			if (!subscription) {
				subscription = await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
				});
			}

			const subscriptionJson = subscription.toJSON();

			const { error: registerError } = await supabase.rpc('register_push_subscription', {
				p_endpoint: subscription.endpoint,
				p_p256dh: subscriptionJson.keys?.p256dh,
				p_auth: subscriptionJson.keys?.auth,
				p_user_agent: navigator.userAgent,
			});

			if (registerError) throw registerError;
			setEnabled(true);
		} catch (enableError) {
			setError((enableError as Error).message || 'Attivazione notifiche non riuscita');
			throw enableError;
		} finally {
			setLoading(false);
		}
	}, [user, availability]);

	const registerIfGranted = useCallback(async () => {
		if (!user || availability !== 'ready' || !supabase) return;
		if (Notification.permission !== 'granted') return;

		setLoading(true);
		setError('');

		try {
			const registration = await navigator.serviceWorker.register(pushServiceWorkerPath, {
				updateViaCache: 'none',
			});
			await registration.update();

			let subscription = await registration.pushManager.getSubscription();

			if (!subscription) {
				subscription = await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
				});
			}

			const subscriptionJson = subscription.toJSON();

			const { error: registerError } = await supabase.rpc('register_push_subscription', {
				p_endpoint: subscription.endpoint,
				p_p256dh: subscriptionJson.keys?.p256dh,
				p_auth: subscriptionJson.keys?.auth,
				p_user_agent: navigator.userAgent,
			});

			if (registerError) throw registerError;
			setEnabled(true);
		} catch (e) {
			setError((e as Error)?.message || 'Registrazione subscription non riuscita');
		} finally {
			setLoading(false);
		}
	}, [user, availability]);

	const disable = useCallback(async () => {
		if (!user || !isSupabaseConfigured || !supabase) return;

		setLoading(true);
		setError('');

		try {
			if ('serviceWorker' in navigator) {
				const registration = await navigator.serviceWorker.getRegistration(pushServiceWorkerPath);
				const subscription = await registration?.pushManager.getSubscription();

				if (subscription) {
					const { error: disableError } = await supabase.rpc('disable_push_subscription', {
						p_endpoint: subscription.endpoint,
					});

					if (disableError) throw disableError;

					await subscription.unsubscribe();
				}
			}

			setEnabled(false);
		} catch (disableError) {
			setError((disableError as Error).message || 'Disattivazione notifiche non riuscita');
			throw disableError;
		} finally {
			setLoading(false);
		}
	}, [user]);

	useEffect(() => {
		const onAppLogout = () => {
			try {
				disable().catch(() => { /* ignore */ });
			} catch {
				// ignore
			}
		};

		const onAppLogin = () => {
			try {
				registerIfGranted().catch(() => { /* ignore */ });
			} catch {
				// ignore
			}
		};

		window.addEventListener('app:logout', onAppLogout);
		window.addEventListener('app:login', onAppLogin);

		return () => {
			window.removeEventListener('app:logout', onAppLogout);
			window.removeEventListener('app:login', onAppLogin);
		};
	}, [user, availability, disable, registerIfGranted]);

	return {
		availability,
		permission,
		enabled,
		loading,
		error,
		enable,
		disable,
	};
}
